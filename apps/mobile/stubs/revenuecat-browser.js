// react-native-purchases always requires its browser/Expo Go simulator
// (about 0.9 MB of JS). Runivo ships as a native build, where the real
// native module is used, so the simulator is replaced with this stub.
module.exports = { browserNativeModuleRNPurchases: undefined };
