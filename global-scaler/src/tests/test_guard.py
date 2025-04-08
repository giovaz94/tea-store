import pytest
from unittest.mock import patch, create_autospec
from src.components.guard import Guard
from src.components.sys_scaler import SysScaler

@pytest.fixture
def mock_scaler():
    MockScaler = create_autospec(SysScaler, spec_set=True)
    MockScaler.get_mcl.return_value = 60
    return MockScaler

@pytest.fixture
def standard_guard(mock_scaler):
    return Guard(mock_scaler, k_big=2, k=5, sleep=2)

def test_get_system_mcl(mock_scaler, standard_guard):
    with patch.object(standard_guard, 'get_inbound_workload', return_value=5):
        # The current system mcl is 60, the inbound workload is 5 then we should downscale
        inbound_workload = standard_guard.get_inbound_workload()
        current_mcl = mock_scaler.get_mcl()

        assert standard_guard.should_scale(inbound_workload, current_mcl) == True
    
    with patch.object(standard_guard, 'get_inbound_workload', return_value=100), \
         patch.object(mock_scaler, 'get_mcl', return_value=80):
        # Now the inbound_workload is bigger than the system mcl, then we should upscale
        inbound_workload = standard_guard.get_inbound_workload()
        current_mcl = mock_scaler.get_mcl()
        assert standard_guard.should_scale(inbound_workload, current_mcl) == True

