# Plan de cambios finales

Este archivo irá recopilando los cambios que se expliquen antes de comenzar a implementarlos.

## 1. Vista inicial al iniciar sesión

- Después de iniciar sesión, mostrar una vista como la segunda captura compartida.
- En el menú lateral deben aparecer solo estos dos módulos:
  - Registro y Admisión
  - Expediente Clínico
- La primera captura representa la vista actual con todos los módulos; la segunda, la vista deseada con solo esos dos.
- **Pendiente de confirmar al completar las explicaciones:** si los demás módulos solo deben ocultarse del menú o también bloquearse para el usuario.

## Más cambios por especificar

### 2. Hacer funcionales todos los botones «X»

- Revisar los botones con una «X» en el sistema y asegurar que cada uno realice la acción esperada.
- En particular, la «X» del campo de búsqueda mostrado en la captura debe limpiar el texto de búsqueda.

### 3. Indicador al recargar pacientes

- Mostrar una ruedita/indicador de carga mientras se recarga la lista de pacientes.
- Interpreté «ruidita» como «ruedita de carga»; si te referías a un sonido audible, lo ajustamos.

### 4. Diagnóstico independiente por ingreso

- Quitar el enlace «Registrar / ver diagnóstico de este ingreso →».
- En su misma posición dentro de cada ingreso, mostrar dos botones: **Ver diagnóstico** y **Registrar diagnóstico**.
- Cada botón debe actuar sobre el ingreso en el que aparece; no debe abrir ni guardar un diagnóstico general del paciente.
- Debe existir un solo diagnóstico asociado a cada ingreso.
- **Pendiente de definir:** qué debe hacer «Registrar diagnóstico» cuando ese ingreso ya tiene uno (permitir editarlo/reemplazarlo o impedir un segundo registro).

### 5. Revisar permisos por rol y acceso a diagnósticos

- **Administrador:** acceso total a todos los módulos y funciones; debe poder ver diagnósticos sin pedir un código. Corregir el problema actual por el que el administrador no logra verlos.
- **Secretaria:** acceso únicamente a **Registro y Admisión** y **Expediente Clínico**. Para ver un diagnóstico, debe ingresar un código de autorización que le proporcione el administrador.
- **Doctor:** mismo acceso que Secretaria: solo **Registro y Admisión** y **Expediente Clínico**; necesita un código del administrador para ver diagnósticos.
- Revisar que los permisos se apliquen tanto en la interfaz como en el backend.

### 6. Simplificar la información del historial de ingresos

- En cada tarjeta del historial, mostrar únicamente la fecha y hora del ingreso; ocultar servicios solicitados, referido por, impresión clínica, conteo de diagnósticos y demás detalles.
- Mantener en la tarjeta los botones **Ver diagnóstico** y **Registrar diagnóstico** solicitados para cada ingreso.

### 7. Ver registro en modo de solo lectura

- Al seleccionar **Ver registro**, mostrar la información del registro únicamente para consulta, sin controles ni campos que permitan modificarla.

### 8. Limpiar textos internos y preparar para producción

- Quitar de las pantallas los textos internos o de desarrollo que no son parte de la interfaz del sistema, por ejemplo etiquetas como «RF-10».
- Revisar los textos visibles para que sean claros y apropiados para usuarios finales.
- Hacer una revisión general de preparación para producción: configuración y secretos, permisos, validaciones, manejo de errores, migraciones, pruebas y despliegue.
- **Pendiente para el despliegue final:** confirmar el servidor/dominio y el entorno de producción que se utilizará.

Se agregarán aquí más cambios conforme se describan. Todavía no se ha implementado ningún cambio de este plan.
