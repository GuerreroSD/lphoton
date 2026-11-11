// Evita una consola extra en Windows en modo release. ¡No quitar!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lphoton_lib::run()
}
