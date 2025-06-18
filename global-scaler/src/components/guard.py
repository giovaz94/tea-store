import os
import time
import threading
from components.sys_scaler import SysScaler
from components.mixer import Mixer
from prometheus_api_client import PrometheusConnect
import numpy as np
import requests


class Guard:
    def __init__(
            self,
            scaler: SysScaler,
            mixer: Mixer,
            predictions,
            k_big = 20,
            k = 10,
            sleep = 10,
    ):
        self.guard_thread = None
        self.log_thread = None
        self.k_big = k_big
        self.k = k
        self.sleep = sleep
        self.running = True

        self.request_scaling = False
        self.scaler = scaler
        self.mixer = mixer

        prometheus_service_address = os.environ.get("PROMETHEUS_SERVICE_ADDRESS", "localhost")
        prometheus_service_port = os.environ.get("PROMETHEUS_SERVICE_PORT", "64155")

        self.monitor_only = os.environ.get("MONITOR_ONLY", "false").lower() == 'true'
        prometheus_url = f"http://{prometheus_service_address}:{prometheus_service_port}"
        self.prometheus_instance = PrometheusConnect(url=prometheus_url)

        self.proactiveness = os.environ.get("PROACTIVE", "false").lower() == 'true' #change to an env variable
        self.proactive_reactive = self.proactiveness and os.environ.get("PROACTIVE_REACTIVE", "false").lower() == 'true' 
        self.predictions = predictions
        

    def start(self) -> None:
        """
        Start the guard process.
        This method will start a new thread that will query the monitor service in order
        to try to check the conditions of the system.

        A second thread will be started to log the metrics of the system.
        """
        self.guard_thread = threading.Thread(target=self.guard)
        self.guard_thread.start()

    def should_scale(self, inbound_workload, current_mcl) -> bool:
        """
        Check the conditions of the system and return True if it should scale.
        """
        return inbound_workload - (current_mcl - self.k_big) > self.k or \
            (current_mcl - self.k_big) - inbound_workload > self.k
    
    def _execute_prometheus_query(self, query: str):
        """
        Execute a query to the Prometheus server.
        """
        try:
            data = self.prometheus_instance.custom_query(query)
            return float(data[0]['value'][1])
        except (requests.exceptions.RequestException, KeyError, IndexError) as e:
            pass

    def guard(self) -> None:
        """
        This method is executed in a separate thread.
        Check the conditions of the system and eventually scale it.
        """
        print("Monitoring the system...")
        iter = 0
        last_pred_conf = []
        current_mcl = self.scaler.get_mcl()
        pred_workload = 0
        config = self.scaler.get_current_config()

        if self.proactiveness:
            pred_workload = sum(self.predictions[iter-self.sleep:])/self.sleep
            last_pred_conf = self.scaler.calculate_configuration(pred_workload + self.k_big)
            current_mcl, _ = self.scaler.process_request(last_pred_conf)

        while self.running:        
            tot = self._execute_prometheus_query(f"sum(increase(http_requests_total_webUI_counter[{self.sleep}s]))")
            completed = self._execute_prometheus_query(f"sum(increase(behaviour_execution[{self.sleep}s]))")
            latency = self._execute_prometheus_query(f"sum(increase(behaviour_time_execution[{self.sleep}s]))")
            avg_lat = latency/(completed if completed > 0 else 1)
            loss = self._execute_prometheus_query(f"sum(increase(message_lost_webUI[{self.sleep}s]))")
            toPrint = str(iter) + " " + str(avg_lat)
              

            #reactivity
            measured_workload = tot/self.sleep#(tot-init_val)/self.sleep
            target_workload = measured_workload
            
            #proactivity
            if iter > 0 and self.proactiveness:
                diff = iter-self.sleep
                pred_workload = sum(self.predictions[diff if diff > 0 else 0:iter])/self.sleep
                target_workload = pred_workload
            if self.proactiveness: toPrint += " next: " + str(pred_workload)
            toPrint += " measured: " + str(measured_workload)
            config = np.sum(self.scaler.get_current_config()) if not self.monitor_only else self._execute_prometheus_query("sum(total_instances_number)")
            #proactivity + reactivity:
            if iter > 0 and self.proactive_reactive:
                measured_conf = self.scaler.calculate_configuration(measured_workload + self.k_big)
                target_workload = self.mixer.mix(measured_workload, pred_workload, last_pred_conf, measured_conf)
                last_pred_conf = self.scaler.calculate_configuration(pred_workload + self.k_big)
            if self.proactive_reactive: toPrint += " mixed: " + str(target_workload)
            toPrint += " tot: " + str(measured_workload * self.sleep) + " comp: " + str(completed) + " rej: " + str(loss) + " supp: " + str(current_mcl) + " inst: " + str(config)
            print(toPrint, flush=True)

            if self.should_scale(target_workload, current_mcl) and not self.monitor_only:
                target_conf = self.scaler.calculate_configuration(target_workload + self.k_big)
                current_mcl, _ = self.scaler.process_request(target_conf)    

            iter += self.sleep
            time.sleep(self.sleep)
