# Plan de nuevos cambios (2)

Este documento recopila los cambios que se vayan describiendo. **No implementar todavía**; esperar a que el usuario termine de explicar.

## 1. Vista inicial de la aplicación

- Al abrir la aplicación, la primera vista debe mostrar únicamente estos módulos en el menú lateral:
  - **Registro y Admisión**
  - **Expediente Clínico**
- No debe aparecer inicialmente el menú completo que se muestra en la captura compartida, aunque la sesión sea de Administrador.
- La captura actual tiene abierta la página de Registro y Admisión, pero muestra todos los módulos; el cambio solicitado es que al iniciar solo se vean Registro y Admisión y Expediente Clínico.
- **Pendiente de confirmar al completar las explicaciones:** si los demás módulos solo se ocultan de la vista inicial y siguen accesibles, o si también deben quedar bloqueados.

## 2. Quitar el párrafo explicativo del escaneo

- En **Registro y Admisión**, quitar el texto explicativo debajo del título **«Escanear expediente físico (opcional)»**:
  > Si el doctor ya llenó el expediente en papel, escanéelo aquí antes de registrar: el sistema genera el PDF automáticamente y trata de leer nombre, DPI, historia clínica, dirección, teléfono y fechas para autorellenar el formulario de abajo (siempre revisable). El PDF original queda guardado tal cual, sin alterar la letra ni la firma del doctor, y se adjunta al paciente al hacer clic en «Guardar paciente».
- Conservar el título y el botón **«Escanear desde este dispositivo»**; solo se solicita quitar el párrafo.

## 3. Desactivar la lectura automática del escaneo

- El escaneo debe limitarse a capturar/recibir las fotos y convertirlas o reunirlas en un PDF.
- No debe intentar leer, reconocer, transcribir ni extraer texto o datos del expediente (sin OCR ni autorelleno automático de campos).
- La información del paciente se ingresará manualmente en el formulario.

## 4. Mantener la vista seleccionada al recargar

- Si el usuario activa el modo de vista donde solo aparecen **Registro y Admisión** y **Expediente Clínico**, conservar esa selección al recargar la página.
- La aplicación debe volver a mostrar esa misma vista restringida después de la recarga, en lugar de regresar al menú completo.

Se agregarán aquí más cambios conforme se describan. No implementar hasta que el usuario indique que ya terminó.
