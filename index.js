const fs = require('fs');
const RpiGpioRts = require('./RpiGpioRts');

// TODO prog button

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
   * @param {Object} api - The Homebridge api
   */
  constructor(log, config, api) {
    if (!config || !config.name || !config.id || !config.shuttingDownDuration || !config.shuttingUpDuration || !config.shuttingLockingDuration) {
      throw new Error(`Invalid or missing configuration.`);
    }
    this.log = log;
    this.api = api;
    this.config = config;
    this.emitter = new RpiGpioRts(log, config);

    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.loadValues();

    this.startInterval();

    this.informationService = new this.Service.AccessoryInformation()
      .setCharacteristic(this.Characteristic.Manufacturer, 'acemtp')
      .setCharacteristic(this.Characteristic.SerialNumber, '1975-06-20-42')
      .setCharacteristic(this.Characteristic.Model, 'SomfyRtsRollerShutter');

    this.windowCoveringService = new this.Service.WindowCovering(this.config.name);

    this.windowCoveringService
      .getCharacteristic(this.Characteristic.CurrentPosition)
      .onGet(() => this.currentPosition);

    this.windowCoveringService
      .getCharacteristic(this.Characteristic.PositionState)
      .onGet(() => this.positionState);

    this.windowCoveringService
      .getCharacteristic(this.Characteristic.TargetPosition)
      .onGet(() => this.targetPosition)
      .onSet(this.setTargetPosition.bind(this));

    if (this.config.prog) {
      this.progService = new this.Service.Switch(`${this.config.name} Prog`);

      this.progService.getCharacteristic(this.Characteristic.On)
        .onGet(() => { this.log.debug(`Function getProg called`); return false; })
        .onSet(value => {
          this.log.debug(`Function setProg called with value ${value}`);
          if (value === true) {
            this.emitter.sendCommand('Prog');
            setTimeout(() => { this.progService.setCharacteristic(this.Characteristic.On, false); }, 500);
          }
        });
    }
    this.log.info('Initialized accessory');
  }

  // Get the latest saved target
  loadValues() {
    const id = parseInt(this.config.id, 10);
    try {
      const json = fs.readFileSync(`./${id}.json`);
      const values = JSON.parse(json);

      this.targetPosition = values.targetPosition; // 100 = open  0 = close
      this.log.debug(`Retrieved targetPosition ${this.targetPosition} from file ./${id}.json`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.targetPosition = 100; // 100 = open  0 = close
        this.log.debug(`No file ./${id}.json, set targetPosition to 100`);
        this.saveValues();
      } else {
        throw err;
      }
    }
    this.currentPosition = this.targetPosition;
    this.positionState = this.Characteristic.PositionState.STOPPED;
  }

  saveValues() {
    const id = parseInt(this.config.id, 10);
    const values = {
      targetPosition: this.targetPosition,
    };
    fs.writeFile(`./${id}.json`, JSON.stringify(values), err => { if (err) throw err; });
    this.log.debug(`Saved targetPosition ${this.targetPosition} in file ./${id}.json`);
  }

  startInterval() {
    const interval = 100;

    setInterval(() => {
      if (this.currentPosition === this.targetPosition) return;

      // compute the new currentPosition depending of the direction
      if (this.currentPosition > this.targetPosition) {
        this.log.debug(`setInterval dec ${this.currentPosition} ${this.targetPosition}`);

        this.currentPosition -= this.currentPosition <= 1 ? interval * 1 / this.config.shuttingLockingDuration : interval * 100 / this.config.shuttingDownDuration;
        this.currentPosition = Math.max(this.currentPosition, this.targetPosition);
      } else if (this.currentPosition < this.targetPosition) {
        this.log.debug(`setInterval inc ${this.currentPosition} ${this.targetPosition}`);

        this.currentPosition += this.currentPosition <= 1 ? interval * 1 / this.config.shuttingLockingDuration : interval * 100 / this.config.shuttingUpDuration;
        this.currentPosition = Math.min(this.currentPosition, this.targetPosition);
      }

      this.windowCoveringService.getCharacteristic(this.Characteristic.CurrentPosition).updateValue(this.currentPosition);

      // if the new current position is the target one, we have to stop
      if (this.currentPosition === this.targetPosition) {
        this.log.debug(`setInterval stop ${this.currentPosition} ${this.targetPosition}`);
        this.currentPosition = this.targetPosition;
        this.positionState = this.Characteristic.PositionState.STOPPED;
        this.windowCoveringService.getCharacteristic(this.Characteristic.PositionState).updateValue(this.Characteristic.PositionState.STOPPED);

        // don't emit stop command if the shutter goes full up or down to be sure it's completely open or close, the shutter engine will auto stop
        if (this.currentPosition !== 0 && this.currentPosition !== 100) {
          this.emitter.sendCommand('My');
        }
        // XXX stop interval
      }
    }, interval);
  }

  setTargetPosition(value) {
    this.log.debug(`Function setTargetPosition called with value ${value}`);
    this.targetPosition = value;
    this.saveValues();

    let newPositionState;
    if ((this.positionState === this.Characteristic.PositionState.INCREASING || this.positionState === this.Characteristic.PositionState.STOPPED) && this.currentPosition > this.targetPosition) {
      newPositionState = this.Characteristic.PositionState.DECREASING;
    } else if ((this.positionState === this.Characteristic.PositionState.DECREASING || this.positionState === this.Characteristic.PositionState.STOPPED) && this.currentPosition < this.targetPosition) {
      newPositionState = this.Characteristic.PositionState.INCREASING;
    }

    if (newPositionState === undefined) return;

    this.log.debug(`Function setTargetPosition start ${newPositionState} ${this.currentPosition} ${this.targetPosition}`);

    this.positionState = newPositionState;
    this.windowCoveringService.getCharacteristic(this.Characteristic.PositionState).updateValue(newPositionState);
    this.emitter.sendCommand(newPositionState === this.Characteristic.PositionState.INCREASING ? 'Up' : 'Down');
  }

  /**
   * Mandatory method for Homebridge
   * Return a list of services provided by this accessory
   *
   * @method getServices
   * @return {Array} - An array containing the services
   */
  getServices() {
    this.log.debug(`Function getServices called`);
    const services = [this.informationService, this.windowCoveringService];
    if (this.progService) services.push(this.progService);
    return services;
  }
}

module.exports = api => {
  api.registerAccessory('homebridge-rpi-somfy-roller-shutter', 'Somfy RTS Roller Shutter', SomfyRtsRollerShutterAccessory);
};
