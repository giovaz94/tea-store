import pytest
import numpy as np

from components.configurator import Configurator
from components.sys_scaler import SysScaler
from components.guard import Guard

@pytest.fixture()
def standard_configurator():
    """             
    Current system given to the configurator:

    IDX | Service name  | MCL | MF
    ------------------------------ 
    0   Message Parser   110    1
    1   Virus Scanner    120    2
    2   Attachment Man   231    1.5
    3   Image Analyzer   231    1.5
    4   Image Rec         90    1.5
    5   NSFW Detector     90    1.5
    6   Message Analyz   300    1
    """

    # Base configuration
    base = np.array([1, 1, 1, 1, 1, 1, 1])

    # Microservices MCL and MF
    microservices_mcl = np.array([22, 24, 46.2, 46.2, 18, 18, 60])
    microservices_mf = np.array([1.0, 2.0, 1.5, 1.5, 1.5, 1.5, 5])

    # Replicas for each increment
    scale_config = np.array([
        [1, 1, 0, 0, 1, 1, 1],  # Increment 1
        [1, 3, 1, 1, 3, 3, 3],  # Increment 2
        [2, 4, 1, 1, 4, 4, 4],  # Increment 3
        [3, 6, 2, 2, 6, 6, 6],  # Increment 4
    ])

    return Configurator(base, scale_config, microservices_mcl, microservices_mf, k_big=2)



@pytest.fixture
def standard_sys_scaler(standard_configurator):
    return SysScaler(standard_configurator, 60)

@pytest.fixture
def standard_guard(standard_sys_scaler):
    return Guard(standard_sys_scaler, k_big=2, k=5, sleep=2)

