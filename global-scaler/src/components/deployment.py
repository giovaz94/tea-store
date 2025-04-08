import yaml
import time
import os
from kubernetes.client.rest import ApiException


def deploy_pod(client, manifest_file_path) -> None:
    """
    Deploy a pod in the cluster.

    Arguments
    -----------
    manifest_file_path -> path to the manifest file to deploy
    """
    try:
        with open(manifest_file_path, 'r') as manifest_file:
            pod_manifest = yaml.safe_load(manifest_file)
            client.create_namespaced_pod(body=pod_manifest, namespace="default")
    except ApiException as e:
        raise Exception(f"Error deploying pod: {e}")


def delete_pod(client, image_name, node_name, namespace="default") -> None:
    """
    Delete a pod by image name.
    The deleted pod must be in a healthy state.

    Arguments
    -----------
    image_name -> the image name of the pod to delete
    """

    try:
        pods = client.list_namespaced_pod("default")
        for pod in pods.items:
            if (
                    pod.metadata.name.startswith(image_name) and
                    #pod.spec.node_name == node_name and
                    pod.metadata.deletion_timestamp is None
            ):
                found_pod_name = pod.metadata.name
                client.delete_namespaced_pod(name=found_pod_name, namespace=namespace)
                break
    except Exception as e:
        raise Exception(f"Error deleting pod: {e}")
