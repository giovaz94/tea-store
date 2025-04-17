import time

from kubernetes import client, config
from prometheus_api_client import PrometheusConnect
from prometheus_client import start_http_server, Gauge
import os
import asyncio
from threading import Thread
import math


if __name__ == '__main__':

    SLEEP_TIME = float(os.environ.get("SLEEP_TIME", "10"))
    COMPONENT_MCL = float(os.environ.get("COMPONENT_MCL", "120"))
    COMPONENT_MF = float(os.environ.get("COMPONENT_MF", "2"))
    K_BIG = int(os.environ.get("K_BIG", "20")) * COMPONENT_MF
    K = int(os.environ.get("K", "10")) * COMPONENT_MF
    METRIC_NAME = os.environ.get("METRIC_NAME", "http_requests_total_parser")
    MANIFEST_NAME = os.environ.get("MANIFEST_NAME", "parser")
    SERVICE_PORT = int(os.environ.get("SERVICE_PORT", "7100"))
   
    IN_CLUSTER = os.environ.get("IN_CLUSTER", "false").lower() == 'true'


    if IN_CLUSTER:
        config.load_incluster_config()
    else:
        config.load_kube_config()

    k8s_client = client.AppsV1Api()

    prometheus_service_address = os.environ.get("PROMETHEUS_SERVICE_ADDRESS", "localhost")
    prometheus_service_port = os.environ.get("PROMETHEUS_SERVICE_PORT", "53165")
    prometheus_url = f"http://{prometheus_service_address}:{prometheus_service_port}"
    prometheus_instance = PrometheusConnect(url=prometheus_url)
    min_inst = int(os.environ.get("MIN_INST", "1"))

    instances_number = Gauge('total_instances_number', 'Present in the system')
    req = []

    def startup_event_loop(event_loop):
        asyncio.set_event_loop(event_loop)
        event_loop.run_forever()

    el = asyncio.new_event_loop()
    Thread(target=lambda: startup_event_loop(el), daemon=True).start()

    def guard(starting_mcl, starting_instances) -> None:
        """
        This method is executed in a separate thread.
        Check the conditions of the system and eventually scale it.
        """
        print("Monitoring the system...")
        current_mcl = starting_mcl
        number_of_instances = starting_instances
        iter = 0
        while True:
            print("Checking the system...", flush=True)
            res = prometheus_instance.custom_query(f"sum(increase({METRIC_NAME}[10s]))")
            tot = float(res[0]['value'][1])
            target_workload = tot
            print(target_workload)
            if iter <= 200: req.append(tot)

            if iter > 0 and should_scale(target_workload, current_mcl):
                inc = K_BIG * COMPONENT_MF
                target_instances = max(math.ceil((inc + target_workload)/COMPONENT_MCL),starting_instances)
                if target_instances != number_of_instances:
                    number_of_instances = target_instances
                    el.call_soon_threadsafe(lambda replicas=target_instances: k8s_client.patch_namespaced_deployment_scale(name=MANIFEST_NAME, namespace="default", body={'spec': {'replicas': replicas}}))
                print(f"Registered workload: {tot/SLEEP_TIME}")
                print(f"Target WL: {target_workload}")
                print(f"Current MCL {current_mcl}, Future MCL: {COMPONENT_MCL * number_of_instances}")
                print(f"Instances: {number_of_instances}")
                current_mcl = COMPONENT_MCL * number_of_instances
                instances_number.set(number_of_instances)
            iter += SLEEP_TIME
            time.sleep(SLEEP_TIME)


    def should_scale(inbound_workload, curr_mcl) -> bool:

        return inbound_workload - (curr_mcl - K_BIG) > K or \
            (curr_mcl - K_BIG) - inbound_workload > K


    def configuration_found(sys_mcl, target_workload, k_big) -> bool:
        return sys_mcl - (target_workload + k_big) >= 0

    start_http_server(SERVICE_PORT)
    guard(COMPONENT_MCL, min_inst)

