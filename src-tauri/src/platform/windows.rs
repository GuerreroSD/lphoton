//! Win32 para el modo ligero (RF3): prioridad de CPU y working set de procesos.
//! Aislado aquí para no bloquear el desarrollo de la UI en otros sistemas.
//! Solo se actúa sobre procesos del mismo usuario; si Windows niega el acceso
//! se devuelve un error y el llamador sigue sin bloquear el juego.

use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::ProcessStatus::EmptyWorkingSet;
use windows::Win32::System::Threading::{
    GetPriorityClass, OpenProcess, SetPriorityClass, IDLE_PRIORITY_CLASS, PROCESS_ACCESS_RIGHTS, PROCESS_CREATION_FLAGS,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_INFORMATION, PROCESS_SET_QUOTA,
};

pub const IDLE_PRIORITY: u32 = IDLE_PRIORITY_CLASS.0;

/// Handle que se cierra solo al salir de alcance.
struct ProcessHandle(HANDLE);

impl ProcessHandle {
    fn open(pid: u32, access: PROCESS_ACCESS_RIGHTS) -> Result<Self, String> {
        // SAFETY: OpenProcess no tiene precondiciones; el handle se valida con `?`.
        unsafe { OpenProcess(access, false, pid) }
            .map(ProcessHandle)
            .map_err(|e| format!("OpenProcess({pid}): {}", e.message()))
    }
}

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        // SAFETY: el handle se obtuvo de OpenProcess y se cierra una sola vez.
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

/// Clase de prioridad actual del proceso (p. ej. NORMAL = 0x20).
pub fn priority(pid: u32) -> Result<u32, String> {
    let handle = ProcessHandle::open(pid, PROCESS_QUERY_LIMITED_INFORMATION)?;
    // SAFETY: handle válido con permiso de consulta.
    let class = unsafe { GetPriorityClass(handle.0) };
    if class == 0 {
        Err(format!("GetPriorityClass({pid}) falló"))
    } else {
        Ok(class)
    }
}

pub fn set_priority(pid: u32, class: u32) -> Result<(), String> {
    let handle = ProcessHandle::open(pid, PROCESS_SET_INFORMATION)?;
    // SAFETY: handle válido con PROCESS_SET_INFORMATION.
    unsafe { SetPriorityClass(handle.0, PROCESS_CREATION_FLAGS(class)) }
        .map_err(|e| format!("SetPriorityClass({pid}): {}", e.message()))
}

/// Pide a Windows que saque de la RAM las páginas del proceso (vuelven si las necesita).
pub fn empty_working_set(pid: u32) -> Result<(), String> {
    let handle = ProcessHandle::open(pid, PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION)?;
    // SAFETY: handle válido con PROCESS_SET_QUOTA, requerido por EmptyWorkingSet.
    unsafe { EmptyWorkingSet(handle.0) }.map_err(|e| format!("EmptyWorkingSet({pid}): {}", e.message()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prueba sobre el propio proceso de test: leer, bajar y restaurar la prioridad.
    #[test]
    fn adjusts_and_restores_own_priority() {
        let pid = std::process::id();
        let original = priority(pid).unwrap();
        set_priority(pid, IDLE_PRIORITY).unwrap();
        assert_eq!(priority(pid).unwrap(), IDLE_PRIORITY);
        set_priority(pid, original).unwrap();
        assert_eq!(priority(pid).unwrap(), original);
        empty_working_set(pid).unwrap();
    }

    #[test]
    fn reports_missing_process() {
        assert!(priority(u32::MAX - 3).is_err());
    }
}
