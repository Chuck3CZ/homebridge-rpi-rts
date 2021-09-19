const fs = require('fs');
const RpiGpioRts = require('./RpiGpioRts');

let Service;
let Characteristic;

// XXX prog button

/**
 * Class simulating a Somfy RTS Remote Accessory for Homebridge
 * with 4 'stateless' switches: Up, Down, My, Prog
 *
 * @class SomfyRtsRollerShutterAccessory
 */
class SomfyRtsRollerShutterAccessory {
  /**
   * Constructor of the class SomfyRtsRollerShutterAccessory
   *
   * @constructor
   * @param {Object} log - The Homebridge log
   * @param {Object} config - The Homebridge config data filtered for this item
   */
  constructor(log, config) {
    this.log = log;
    if (!config || !config.name || !config.id || !config.shuttingDownDuration || !config.shuttingUpDuration || !config.shuttingLockingDuration) {
      throw new Error(`Invalid or missing configuration.`);
    }
    this.config = config;
    this.emitter = new RpiGpioRts(log, config);

    this.loadValues();

    const interval = 100;

    setInterval(() => {
      if (this.currentPosition === this.targetPosition) return;

      // compute the new currentPosition depending of the direction
      if (this.currentPosition > this.targetPosition) {
        this.log.debug(`setInterval dec ${this.currentPosition} ${this.targetPosition}`);

        this.currentPosition -= this.currentPosition <= 1 ? interval * 1 / config.shuttingLockingDuration : interval * 100 / config.shuttingDownDuration;
        this.currentPosition = Math.max(this.currentPosition, this.targetPosition);
      } else if (this.currentPosition < this.targetPosition) {
        this.log.debug(`setInterval inc ${this.currentPosition} ${this.targetPosition}`);

        this.currentPosition += this.currentPosition <= 1 ? interval * 1 / config.shuttingLockingDuration : interval * 100 / config.shuttingUpDuration;
        this.currentPosition = Math.min(this.currentPosition, this.targetPosition);
      }

      this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.currentPosition);

      // if the new current position is the target one, we have to stop
      if (this.currentPosition === this.targetPosition) {
        this.log.debug(`setInterval stop ${this.currentPosition} ${this.targetPosition}`);
        this.currentPosition = this.targetPosition;
        this.positionState = Characteristic.PositionState.STOPPED;
        this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.STOPPED);

        // don't emit stop command if the shutter goes full up or down to be sure it's completely open or close, the shutter engine will auto stop
        if (this.currentPosition !== 0 && this.currentPosition !== 100) {
          this.emitter.sendCommand('My');
        }
        // XXX stop interval
      }
    }, interval);

    // your accessory must have an AccessoryInformation service
    this.informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'acemtp')
      .setCharacteristic(Characteristic.SerialNumber, '1975-06-20-42')
      .setCharacteristic(Characteristic.Model, 'SomfyRtsRollerShutter');

    this.windowCoveringService = new Service.WindowCovering(this.config.name);

    this.windowCoveringService
      .getCharacteristic(Characteristic.CurrentPosition)
      .on('get', this.getCurrentPosition.bind(this));

    this.windowCoveringService
      .getCharacteristic(Characteristic.PositionState)
      .on('get', this.getPositionState.bind(this));

    this.windowCoveringService
      .getCharacteristic(Characteristic.TargetPosition)
      .on('get', this.getTargetPosition.bind(this))
      .on('set', this.setTargetPosition.bind(this));

    this.log.info(`Initialized accessory`);
  }

  // Get the latest saved target
  loadValues() {
    const id = parseInt(this.config.id, 10);
    try {
      const json = fs.readFileSync(`./${id}.json`);
      const values = JSON.parse(json);

      this.targetPosition = values.targetPosition; // 100 = open  0 = close
      this.log.info(`Retrieved targetPosition ${this.targetPosition} from file ./${id}.json`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.targetPosition = 100; // 100 = open  0 = close
        this.log.info(`No file ./${id}.json, set targetPosition to 100`);
        this.saveValues();
      } else {
        throw err;
      }
    }
    this.currentPosition = this.targetPosition;
    this.positionState = Characteristic.PositionState.STOPPED;
  }

  saveValues() {
    const id = parseInt(this.config.id, 10);
    const values = {
      targetPosition: this.targetPosition,
    };
    fs.writeFile(`./${id}.json`, JSON.stringify(values), err => { if (err) throw err; });
    this.log.info(`Saved targetPosition ${this.targetPosition} in file ./${id}.json`);
  }

  /**
   * Getter for the 'getCurrentPosition' characteristic of the 'WindowCovering' service
   *
   * @method getCurrentPosition
   * @param {Function} callback - A callback function from Homebridge
   */
  getCurrentPosition(callback) {
    this.log.info(`Function getCurrentPosition called and return ${this.currentPosition}`);
    callback(null, this.currentPosition);
  }

  /**
   * Getter for the 'getPositionState' characteristic of the 'WindowCovering' service
   *
   * @method getPositionState
   * @param {Function} callback - A callback function from Homebridge
   */
  getPositionState(callback) {
    this.log.info(`Function getPositionState called and return ${this.positionState}`);
    callback(null, this.positionState);
  }

  /**
   * Getter for the 'getTargetPosition' characteristic of the 'WindowCovering' service
   *
   * @method getTargetPosition
   * @param {Function} callback - A callback function from Homebridge
   */
  getTargetPosition(callback) {
    this.log.info(`Function getTargetPosition called and return ${this.targetPosition}`);
    callback(null, this.targetPosition);
  }

  /**
   * Setter for the 'setTargetPosition' characteristic of the 'WindowCovering' service
   *
   * @method setTargetPosition
   * @param {Object} value - The value for the characteristic
   * @param {Function} callback - A callback function from Homebridge
   */
  setTargetPosition(value, callback) {
    this.log.info(`Function setTargetPosition called with value ${value}`);
    this.targetPosition = value;
    this.saveValues();

    if (this.positionState === Characteristic.PositionState.STOPPED) {
      if (this.currentPosition > this.targetPosition) {
        // need to start a dec on the shutter
        this.log.info(`Function setTargetPosition start dec ${this.currentPosition} ${this.targetPosition}`);
        this.positionState = Characteristic.PositionState.DECREASING;
        this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.DECREASING);
        this.emitter.sendCommand('Down');
        // XXX start interval
      } else if (this.currentPosition < this.targetPosition) {
        // need to start a inc on the shutter
        this.log.info(`Function setTargetPosition start inc ${this.currentPosition} ${this.targetPosition}`);
        this.positionState = Characteristic.PositionState.INCREASING;
        this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.INCREASING);
        this.emitter.sendCommand('Up');
        // XXX start interval
      }
    } else if (this.positionState === Characteristic.PositionState.DECREASING) {
      if (this.currentPosition > this.targetPosition) {
        // need to continue a dec on the shutter
        this.log.info(`Function setTargetPosition continue dec ${this.currentPosition} ${this.targetPosition}`);
      } else if (this.currentPosition < this.targetPosition) {
        // need to start a inc on the shutter
        this.log.info(`Function setTargetPosition switch start inc ${this.currentPosition} ${this.targetPosition}`);
        this.positionState = Characteristic.PositionState.INCREASING;
        this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.INCREASING);
        this.emitter.sendCommand('Up');
      }
    } else if (this.positionState === Characteristic.PositionState.INCREASING) {
      if (this.currentPosition > this.targetPosition) {
        // need to start a inc on the shutter
        this.log.info(`Function setTargetPosition switch start dec ${this.currentPosition} ${this.targetPosition}`);
        this.positionState = Characteristic.PositionState.DECREASING;
        this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.DECREASING);
        this.emitter.sendCommand('Down');
      } else if (this.currentPosition < this.targetPosition) {
        // need to continue a inc on the shutter
        this.log.info(`Function setTargetPosition continue inc ${this.currentPosition} ${this.targetPosition}`);
      }
    }

    callback(null);
  }

  /**
   * Mandatory method for Homebridge
   * Return a list of services provided by this accessory
   *
   * @method getServices
   * @return {Array} - An array containing the services
   */
  getServices() {
    this.log.info(`Function getServices called`);
    return [this.informationService, this.windowCoveringService];
  }
}

module.exports = homebridge => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-rpi-somfy-roller-shutter', 'Somfy RTS Roller Shutter', SomfyRtsRollerShutterAccessory);
};
