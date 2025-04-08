import numpy as np

def test_extimate_mcl(standard_configurator):
    base = np.array([1, 1, 1, 1, 1, 1, 1])
    assert standard_configurator.estimate_mcl(base) == 60

    config_1 = base + np.array([0, 1, 0, 0, 1, 1, 1])
    assert standard_configurator.estimate_mcl(config_1) == 110

    config_2 = config_1 + np.array([1, 0, 0, 0, 0, 0, 0])
    assert standard_configurator.estimate_mcl(config_2) == 120

    config_3 = config_2 + np.array([0, 1, 0, 0, 1, 1, 1])
    assert standard_configurator.estimate_mcl(config_3) == 154

    config_4 = config_3 + np.array([0, 0, 1, 1, 0, 0, 0])
    assert standard_configurator.estimate_mcl(config_4) == 180

def test_configuration(standard_configurator):
    assert np.equal(standard_configurator.calculate_configuration(10)[0], np.array([0, 0, 0, 0])).all()
    assert np.equal(standard_configurator.calculate_configuration(14)[0], np.array([1, 0, 0, 0])).all()
    assert np.equal(standard_configurator.calculate_configuration(30)[0], np.array([0, 1, 0, 0])).all()
    assert np.equal(standard_configurator.calculate_configuration(50)[0], np.array([0, 0, 1, 0])).all()
    assert np.equal(standard_configurator.calculate_configuration(60)[0], np.array([0, 0, 0, 1])).all()
    
    # Continue scaling
    assert np.equal(standard_configurator.calculate_configuration(90)[0], np.array([1, 0, 0, 1])).all()
    assert np.equal(standard_configurator.calculate_configuration(100)[0], np.array([0, 1, 0, 1])).all()
    assert np.equal(standard_configurator.calculate_configuration(110)[0], np.array([0, 0, 1, 1])).all()
    assert np.equal(standard_configurator.calculate_configuration(130)[0], np.array([0, 0, 0, 2])).all()
    assert np.equal(standard_configurator.calculate_configuration(154)[0], np.array([0, 1, 0, 2])).all()