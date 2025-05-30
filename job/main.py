from kubernetes import client, config
from datetime import datetime
from collections import defaultdict
import pytz
import time
import os

# Load kube config
try:
    config.load_incluster_config()
except:
    config.load_kube_config()

v1 = client.CoreV1Api()
pod_age_limit = int(os.environ.get("POD_AGE_LIMIT", "60"))

def get_ready_time(pod):
    try:
        conditions = pod.status.conditions or []
        for condition in conditions:
            if condition.type == "Ready" and condition.status == "True":
                return condition.last_transition_time
        return None
    except Exception as e:
        print(f"Failed to get Ready time for pod {pod.metadata.name}: {e}")
        return None

def get_eta_seconds(pod):
    try:
        ready_time = get_ready_time(pod)
        if ready_time is None:
            return None
        now = datetime.now(pytz.utc)
        return (now - ready_time).total_seconds()
    except Exception as e:
        print(f"Failed to parse ETA for pod {pod.metadata.name}: {e}")
        return None

def get_base_name(name):
    return '-'.join(name.split('-')[:-1]) or name

def patch_label(namespace, pod_name, label_key, label_value):
    patch_body = {
        "metadata": {
            "labels": {
                label_key: label_value
            }
        }
    }
    try:
        v1.patch_namespaced_pod(
            name=pod_name,
            namespace=namespace,
            body=patch_body
        )
        print(f"Patched pod {pod_name} - set {label_key}:{label_value}")
    except Exception as e:
        print(f"Error patching pod {pod_name}: {e}")

def main():
    print("chechking...")
    pods = v1.list_pod_for_all_namespaces(watch=False)

    pod_groups = defaultdict(list)

    for pod in pods.items:
        labels = pod.metadata.labels or {}
        if "traffic" in labels:
            base_name = get_base_name(pod.metadata.name)
            pod_groups[(pod.metadata.namespace, base_name)].append(pod)

    # First pass: turn off new:true if no pod in group has eta < pod_age_limit
    for (namespace, base_name), group_pods in pod_groups.items():
        candidate_pods = [p for p in group_pods if "traffic" in p.metadata.labels]

        eta_list = [get_eta_seconds(p) for p in candidate_pods]
        all_eta_above_limit = all(eta > pod_age_limit for eta in eta_list if eta is not None)

        if all_eta_above_limit:
            for p in candidate_pods:
                if p.metadata.labels.get("traffic") == "enabled":
                    continue
                patch_label(p.metadata.namespace, p.metadata.name, "traffic", "enabled")
            continue

        for pod in candidate_pods:
            eta_seconds = get_eta_seconds(pod)
            if eta_seconds is None or eta_seconds <= pod_age_limit or pod.metadata.labels.get("traffic") == "disabled":
                continue
            patch_label(pod.metadata.namespace, pod.metadata.name, "traffic", "disabled")

if __name__ == "__main__":
    for i in range(0, 18):
        main()
        time.sleep(5)
