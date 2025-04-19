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
pod_age_limit = int(os.environ.get("POD_AGE_LIMIT", "30"))


def get_eta_seconds(pod):
    try:
        eta = pod.status.start_time
        now = datetime.now(pytz.utc)
        return (now - eta).total_seconds()
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
    pods = v1.list_pod_for_all_namespaces(watch=False)
 
    pod_groups = defaultdict(list)
 
    for pod in pods.items:
        labels = pod.metadata.labels or {}
        if "new" in labels and "old" in labels:
            base_name = get_base_name(pod.metadata.name)
            pod_groups[(pod.metadata.namespace, base_name)].append(pod)
 
    # First pass: turn off new:true if no pod in group has eta < 30s
    for (namespace, base_name), group_pods in pod_groups.items():
        candidate_pods = [p for p in group_pods if p.metadata.labels.get("new") == "true" and p.metadata.labels.get("old") == "true"]

        eta_list = [get_eta_seconds(p) for p in candidate_pods]
        all_eta_above_30 = all(eta > 30 for eta in eta_list if eta is not None)

        if all_eta_above_30:
            for p in candidate_pods:        
                patch_label(p.metadata.namespace, p.metadata.name, "new", "true")

 
        has_eta_below_al = False
        for pod in candidate_pods:
            eta_seconds = get_eta_seconds(pod)
            if eta_seconds is not None and eta_seconds < pod_age_limit:
                has_eta_below_al = True
                break
 
        if not has_eta_below_al:
            for pod in candidate_pods:
                eta_seconds = get_eta_seconds(pod)
                if eta_seconds is None or eta_seconds <= pod_age_limit:
                    continue
                patch_label(pod.metadata.namespace, pod.metadata.name, "new", "false")
 
    # Second pass: restore new:true if ALL pods have new:false
    for (namespace, base_name), group_pods in pod_groups.items():
        all_new_false = all(p.metadata.labels.get("new") == "false" for p in group_pods)
 
        if all_new_false and group_pods:
            # Pick the first pod and restore new:true
            pod_to_restore = group_pods[0]
            patch_label(pod_to_restore.metadata.namespace, pod_to_restore.metadata.name, "new", "true")
 
 
if __name__ == "__main__":
    for i in range(0,10):
        main()
        time.sleep(5)