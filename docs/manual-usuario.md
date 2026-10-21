# Manual de usuario — Sistema de Expediente Clínico y Administrativo

**Hospital de Especialidades Verapaz — Cobán, Alta Verapaz**

Este manual describe cómo usar el sistema en el día a día: iniciar sesión, registrar pacientes, llevar el expediente clínico, facturar, administrar farmacia e inventario, y consultar reportes. Está organizado por tarea. Si no encuentra una acción, revise primero la sección 3 (roles y permisos): muchas pantallas son visibles para todos los usuarios, pero no todos pueden ejecutar las mismas acciones.

---

## 1. Antes de empezar

### 1.1 Qué necesita
- Un navegador actualizado (Chrome, Edge o Firefox).
- La dirección del sistema que le entregó el administrador técnico (por ejemplo `http://<servidor>:8080`).
- Un usuario y contraseña creados por el Administrador del sistema.
- Para escanear expedientes con la cámara de la computadora o del teléfono: permiso de cámara en el navegador.

### 1.2 Qué hace el sistema
El sistema cubre los procesos administrativos y clínicos del hospital:

| Módulo | Para qué sirve |
|---|---|
| Registro y Admisión | Registrar pacientes nuevos, capturar sus datos de ingreso y egreso, consultar pacientes registrados. |
| Expediente Clínico | Consultar y registrar diagnósticos confidenciales de cada ingreso del paciente. |
| Documentos del Paciente | Subir, ver y descargar documentos escaneados del paciente (identificaciones, referencias, constancias). |
| Tratamiento | Registrar tratamientos intrahospitalarios, medicamentos usados de farmacia y recetas médicas. |
| Clientes Referidos | Registrar médicos o instituciones que refieren pacientes, con su comisión. |
| Área Financiera | Generar facturas de hospital, consultar costeo del paciente y ver el reporte financiero. |
| Gastos del Hospital | Registrar gastos y clasificarlos por categoría fiscal. |
| Farmacia | Administrar el inventario, registrar entradas y salidas, y vender medicamentos. |
| Seguridad y Roles | Crear usuarios, asignar roles y generar tokens de acceso temporal. |
| Reportes | Consultar reportes administrativos, financieros y de auditoría. |

> **Nota:** el módulo "Bitácora de Visitas" fue retirado del menú de la interfaz. No aparece en el sistema para ningún usuario.

---

## 2. Acceso al sistema

### 2.1 Iniciar sesión
1. Abra la dirección del sistema en el navegador.
2. Escriba su **correo** y **contraseña** en la pantalla de inicio de sesión.
3. Presione **Ingresar**.

Si la contraseña es incorrecta, el sistema muestra "Credenciales inválidas". Después de **10 intentos fallidos desde la misma dirección de red en 5 minutos**, el sistema bloquea nuevos intentos durante unos minutos; espere el tiempo indicado en el mensaje.

### 2.2 Sesión
- La sesión dura **8 horas** desde el inicio de sesión. Pasado ese tiempo, el sistema le pedirá iniciar sesión de nuevo.
- Para salir, use el botón de **cerrar sesión** del menú lateral. Cierre siempre la sesión en computadoras compartidas.

### 2.3 Recuperar la contraseña
1. En la pantalla de inicio de sesión, use el enlace de **recuperar contraseña**.
2. Escriba el correo de su cuenta y envíe la solicitud.
3. El sistema responde siempre con el mismo mensaje, exista o no el correo (por seguridad).
4. Si recibió el enlace, ábralo: expira en **30 minutos** y solo puede usarse **una vez**.
5. Escriba la nueva contraseña (mínimo 8 caracteres) y confírmela.

Si no recibe el enlace, comuníquese con el Administrador del sistema.

### 2.4 Navegación y modo restringido
- El menú lateral izquierdo muestra los módulos del sistema. Los módulos a los que su rol no tiene acceso de escritura siguen visibles, pero las acciones que no le corresponden devuelven el mensaje **"No tiene permiso para esta accion"**.
- Al presionar el **logo del hospital** en la parte superior del menú se activa el **modo restringido**: solo quedan visibles **Registro y Admisión** y **Expediente Clínico**. Útil para trabajar sin distracciones. Presione el logo de nuevo para volver al menú completo.

---

## 3. Roles y permisos

Cada usuario tiene uno o más roles. Un usuario puede tener varios roles a la vez (por ejemplo, Recepción y Facturación).

| Rol | Puede hacer en el sistema |
|---|---|
| **Administrador** | Todo lo del sistema. Ve diagnósticos **sin token**. Administra usuarios, tokens, categorías fiscales y reportes. |
| **Recepción / Admisión** | Registrar y editar pacientes, registrar ingresos y egresos, subir y eliminar documentos del paciente, iniciar escaneos, registrar clientes referidos. Puede ver el expediente solo con token. |
| **Personal de Consulta** (médicos) | Registrar tratamientos y recetas médicas (es el médico responsable de la receta). Ver documentos del paciente. Ver el expediente con token. Puede autogenerar su token si el Administrador se lo permitió. |
| **Enfermería / Secretaría** | Registrar tratamientos. Ver documentos del paciente. Ver el expediente con token. |
| **Facturación** | Generar facturas de hospital, consultar costeo y reporte financiero, registrar gastos y consultar categorías fiscales. No ve documentos del paciente. |
| **Farmacia** | Administrar el inventario, registrar entradas y salidas, y realizar ventas de farmacia. |

### 3.1 Tokens de acceso temporal (expediente)
El diagnóstico es información confidencial. Para verlo o registrarlo, un usuario que **no** es Administrador necesita un **token de acceso temporal**:

- Dura **15 minutos** y es de **un solo uso**: se consume al verificarse para ver o registrar un diagnóstico.
- Se emite para un usuario concreto. (La interfaz no permite limitarlo a un paciente; cualquier paciente puede consultarse mientras el token esté vigente.)
- Puede obtenerlo de dos maneras:
  - **Autogenerado:** si su usuario tiene el permiso *Puede autogenerar sus propios tokens (RF-34)*, presione *Autogenerar token* en la ventana de confirmación del expediente.
  - **Emitido por el Administrador:** el Administrador lo genera en **Seguridad y Roles** y se lo entrega; péguelo en el campo *Token de acceso temporal*.

Si el token expiró o ya se usó, el sistema lo indica y debe obtener uno nuevo.

---

## 4. Registro y Admisión

Ruta del menú: **Registro y Admisión**. Tiene tres pestañas:

- **+ Paciente nuevo**: registro de un paciente que aún no existe en el sistema.
- **Ingreso / Egreso**: completar o corregir los datos de ingreso y egreso de un paciente ya registrado.
- **Pacientes registrados**: búsqueda y listado de pacientes.

### 4.1 Buscar un paciente existente
1. Abra **Pacientes registrados**.
2. Escriba parte del **nombre**, el **DPI** o la **historia clínica**. La búsqueda empieza sola (con una pequeña pausa al escribir).
3. Use la paginación para ver más resultados.

Antes de registrar un paciente nuevo, busque siempre si ya existe: el sistema no permite dos pacientes con el mismo DPI.

### 4.2 Registrar un paciente nuevo
1. Abra **+ Paciente nuevo**.
2. (Opcional) En **Escanear expediente físico**, elija cómo escanear el documento (ver sección 4.4). El sistema puede rellenar algunos datos básicos a partir del escaneo; **revise siempre** los datos rellenados antes de guardar.
3. Complete los **campos obligatorios**:

| Campo | Regla |
|---|---|
| Fecha y hora de ingreso | Hora en formato **HHMM** (cuatro dígitos, por ejemplo `1430`). |
| Historia clínica | Solo números, máximo 40 dígitos. |
| Nombre completo | Obligatorio. |
| DPI | 13 dígitos. El sistema valida el dígito verificador y el código de departamento. |
| Dirección, teléfono, lugar y fecha de nacimiento | Obligatorios. El teléfono tiene 8 dígitos (formato `0000 0000`). |
| Edad | Entero entre 0 y 130. |
| Sexo, estado civil, ocupación, religión, nacionalidad | Obligatorios. El estado civil se elige entre Soltero/a, Casado/a, Unido/a, Divorciado/a, Viudo/a. |

4. Complete los **datos opcionales** si aplica: cónyuge, padre y madre, contacto de emergencia, otras hospitalizaciones, referido por, servicios solicitados e impresión clínica de ingreso.
5. En la sección de **datos opcionales**, debajo de *Operaciones*, use **Adjuntar archivos** para agregar resultados clínicos (ver sección 4.5).
6. Si el paciente nació en el hospital, complete la sección **Maternidad** (número de hijo, fecha y hora de nacimiento, sexo, condición del bebé, autopsia del bebé si aplica, datos del padre).
7. Presione **Guardar paciente**.

Si el DPI ya existe, el sistema muestra "Ya existe un paciente con este DPI" e indica la historia clínica del paciente registrado: en ese caso, busque al paciente en lugar de registrarlo de nuevo.

Al guardar, el sistema crea también el **primer ingreso** del paciente con la fecha, hora e impresión clínica capturadas.

### 4.3 Ingreso / Egreso
Use esta pestaña para completar datos de egreso o corregir datos de un paciente ya registrado.

1. Seleccione el paciente.
2. Revise o modifique los datos. Solo se envían los campos que cambió; el resto se conserva.
3. Para el egreso:
   - **Fecha y hora de egreso** (HHMM).
   - **Condición de egreso**: Curado, Contra indicado, Referido a otra institución, Mejorado, Fallecido antes de 48 horas o Fallecido después de 48 horas.
   - **Diagnóstico de egreso** y **complicaciones**: cada una con descripción y código CIE-10. Puede buscar el código por descripción o por código.
   - **Operaciones**: lista de texto en orden de importancia; use *Agregar operación* para sumar más.
   - **Autopsia** y **causa de muerte**: solo se pueden registrar si la condición de egreso es de fallecimiento.
4. Sección **Maternidad**: igual que en el registro de paciente nuevo.
5. **Adjuntar archivos** (resultados clínicos): los archivos se suben **al presionar Guardar cambios**, después de guardar los datos.
6. Presione **Guardar cambios**.

### 4.4 Escanear el expediente físico
Puede digitalizar el expediente en papel para guardarlo con el paciente. Hay dos formas:

- **Escanear en esta computadora**: usa la cámara conectada a la computadora. Tome las fotos de cada hoja, revise el resultado y confírmelo.
- **Escanear con el teléfono**: el sistema muestra un código QR. Escanéelo con la cámara del teléfono; se abre una página donde toma las fotos y las envía. La sesión vence a los **10 minutos**. Un documento por sesión.

El documento escaneado se guarda como **PDF** (máximo **20 MB**) cuando se guarda el paciente. Si el hospital tiene activada la lectura avanzada, el sistema puede leer mejor la letra a mano; en ese caso la imagen de la primera hoja se envía a un servicio externo, por lo que la activación es una decisión del hospital.

### 4.5 Adjuntar archivos (resultados clínicos)
Disponible en **Paciente nuevo** e **Ingreso / Egreso**, en la parte de datos opcionales debajo de *Operaciones*.

- Puede elegir **hasta 10 archivos** a la vez (PDF, PNG o JPG).
- Verifique los nombres de la lista antes de guardar; use el ícono de papelera para quitar uno.
- Los archivos se guardan cifrados y quedan en la ficha del paciente, en **Documentos del Paciente**.

---

## 5. Expediente Clínico

Ruta del menú: **Expediente Clínico**.

### 5.1 Seleccionar un paciente
Busque al paciente con el buscador de la parte superior. La ficha muestra sus datos básicos y el **Historial de ingresos**.

### 5.2 Historial de ingresos y nuevo ingreso
- Cada paciente tiene **una sola identidad** (nombre, DPI, historia clínica), pero puede tener **varios ingresos**. Cada ingreso tiene su fecha, hora, impresión clínica y diagnósticos.
- La lista muestra todos los ingresos, con el más reciente primero.
- Para registrar una nueva estadía, presione **Nuevo ingreso**. Los datos del paciente aparecen fijos (no se cambian); complete:
  - Fecha y hora de ingreso.
  - Impresión clínica de ingreso.
  - Servicios solicitados y referido por (opcional).
- Presione **Guardar ingreso**.

### 5.3 Ver el diagnóstico (información confidencial)
1. Seleccione el paciente y presione **Ver diagnóstico**.
2. Lea el aviso: la consulta queda registrada a su nombre.
3. Confirme:
   - **Administrador**: presione *Continuar y ver diagnóstico*.
   - **Otros roles**: pegue su token (sección 3.1) o autogénerelo, y presione *Confirmar y ver diagnóstico*.
4. El diagnóstico aparece con sus secciones. Si tiene versiones anteriores, use **Ver historial** para consultarlas.

El token se consume al verificarse. Para volver a ver el diagnóstico necesitará otro token.

### 5.4 Registrar un diagnóstico
1. Seleccione el paciente.
2. El botón **Registrar diagnóstico** aparece:
   - Para el **Administrador**, siempre que haya un paciente seleccionado.
   - Para los demás roles, solo cuando hay un **token vigente** cargado en la sesión (sección 5.3). Como el token se consume al ver el diagnóstico, para registrar después de haberlo consultado necesitará **otro token**: pegue o autogenere uno en la ventana de acceso y el botón aparecerá.
3. Presione **Registrar diagnóstico**. Se abre el formulario, que contiene:
   1. **Información general**: fecha, hora, especialidad, tipo de atención (consulta externa, emergencia, hospitalización, seguimiento), servicio, sala/cama (solo en hospitalización o emergencia), y **Ingreso al que pertenece** (por defecto, el más reciente).
   2. **Motivo de consulta**.
   3. **Historia de la enfermedad actual**.
   4. **Signos y síntomas relevantes** (casillas y campo de otros).
   5. **Signos vitales**: PA, FC, FR, temperatura, SpO₂, peso y talla; el IMC se calcula solo.
   6. **Exploración física** por sistemas (general, cabeza/cuello, cardiovascular, respiratorio, abdomen, neurológico, extremidades, piel, otros).
   7. **Estudios y resultados**: tipo, fecha, resultado y archivo adjunto opcional (PDF o imagen, máximo 5 MB por archivo). Use *Agregar estudio* para sumar más.
   8. **Diagnóstico principal**: descripción, código CIE-10, tipo (presuntivo o definitivo), prioridad, estado y fecha.
   9. **Diagnósticos secundarios** (opcionales), en orden de importancia; use *Agregar diagnóstico*.
   10. **Impresión clínica** y **Plan y conducta**.
4. Presione **Guardar diagnóstico**.

Los diagnósticos **no se sobrescriben**: cada guardado crea una nueva versión, y la anterior queda en el historial. Así se puede auditar quién registró o corrigió cada diagnóstico.

Para cerrar el formulario sin guardar use **Ocultar formulario de diagnóstico**.

---

## 6. Documentos del Paciente

Ruta del menú: **Documentos del Paciente**. Para documentos generales: identificaciones, referencias, constancias y escaneos sueltos.

- **Subir**: seleccione el paciente, elija uno o varios archivos (PDF, PNG o JPG, máximo 20 MB cada uno) y presione **Subir y cifrar**.
- **Ver/descargar**: abre el documento en una pestaña nueva con su formato original.
- **Eliminar**: el documento deja de mostrarse, pero el sistema conserva el archivo por política de retención. Solo Recepción y Administrador pueden eliminar.

> Los resultados de exámenes van en **Expediente Clínico** (estudios del diagnóstico) o como **archivos adjuntos** del registro o de ingreso/egreso (sección 4.5). Este módulo no es para resultados de exámenes.

---

## 7. Tratamiento

Ruta del menú: **Tratamiento**. Seleccione el paciente y use:

### 7.1 Registrar tratamiento
- **Descripción**, **costo** (en quetzales, mayor o igual a 0), **origen**:
  - *Intrahospitalario*: insumos o procedimientos del hospital.
  - *Farmacia (venta directa)*: medicamento de farmacia usado durante la estadía.
- Para procedimientos quirúrgicos puede registrar cirujano, ayudante, instrumentista y anestesiólogo.
- Presione **Registrar**. Estos cargos se suman al costeo del paciente y se cobran en la próxima factura del hospital.

### 7.2 Recetas médicas
- Medicamento, dosis, indicaciones y duración.
- Seleccione el **médico responsable**: debe ser un usuario con rol de Consulta.
- Presione **Registrar receta**. Para imprimir una receta use **Imprimir** en su fila de la lista de recetas.

---

## 8. Clientes Referidos

Ruta del menú: **Clientes Referidos**. Registre médicos externos o instituciones que refieren pacientes:
- Nombre (obligatorio), especialidad y **comisión en quetzales por paciente** (obligatoria).
- En la versión actual la pantalla permite crear y consultar registros; no tiene opción de edición.

---

## 9. Área Financiera

Ruta del menú: **Área Financiera**. Disponible para Facturación y Administrador.

### 9.1 Generar factura del hospital
1. Seleccione el paciente. El sistema muestra el **costeo pendiente**: los cargos de tratamiento que aún no se han facturado.
2. Escriba el **costo del hospital** (mayor o igual a 0).
3. Elija la **forma de pago**: Efectivo o Transferencia.
4. Presione **Generar factura**.

El total es el costo del hospital más los tratamientos pendientes. Los tratamientos quedan marcados como facturados, por lo que **nunca se cobran dos veces**. Si ocurre un error durante la factura, el sistema no deja nada a medias.

### 9.2 Reporte financiero
Seleccione un rango de fechas y revise ingresos de hospital y farmacia, gastos, impuesto estimado e ingreso neto. El impuesto es **informativo**; el cálculo oficial lo realiza el contador del hospital.

---

## 10. Gastos del Hospital

Ruta del menú: **Gastos del Hospital**. Disponible para Facturación y Administrador.

- Para registrar un gasto: **fecha de la factura**, **proveedor**, **monto** (mayor a 0), **categoría fiscal**, número de factura y descripción (opcional).
- El sistema calcula un impuesto estimado según la categoría. Ese valor queda fijo al momento de registrar el gasto aunque la tasa cambie después.
- Para eliminar un gasto, use el botón de eliminar de su fila.
- El **catálogo de categorías fiscales** solo lo edita el Administrador. Confirme las categorías y tasas con su contador antes de usarlas para declarar.

---

## 11. Farmacia

Ruta del menú: **Farmacia**. Disponible para el rol Farmacia y el Administrador.

### 11.1 Inventario
- Cada medicamento tiene nombre, tipo, presentación, stock, **stock mínimo**, precio de venta, fecha de vencimiento y proveedor.
- Use el buscador para encontrar un medicamento.
- El sistema alerta cuando el **stock está bajo** o un medicamento está **próximo a vencer**.
- Para agregar un medicamento, use el formulario de nuevo medicamento; para corregir datos, edítelo.

### 11.2 Entradas y salidas
- **Entrada** (compra o reposición): seleccione el medicamento, la cantidad (mayor a 0) y registre la entrada.
- **Salida para uso intrahospitalario**: requiere **seleccionar el paciente**. La salida no puede superar el stock disponible.

### 11.3 Venta directa
1. Agregue medicamentos al carrito con su cantidad.
2. Opcional: asocie la venta a un paciente (solo para trazabilidad; no se carga a su costeo).
3. Presione **Registrar venta**.

El sistema descuenta el stock, registra el movimiento y genera la factura de farmacia. Si un medicamento no tiene stock suficiente, la venta completa se rechaza y el mensaje indica cuál medicamento falló.

El **kardex** (historial de movimientos) se consulta desde **Reportes**.

---

## 12. Seguridad y Roles

Ruta del menú: **Seguridad y Roles**. Solo para el Administrador.

### 12.1 Crear un usuario
1. Complete el formulario *Crear usuario*.
2. Complete **nombre**, **correo**, **contraseña temporal** y **roles** (puede marcar más de uno).
3. Si el usuario es de Consulta, complete el **número de colegiado** y la **especialidad**; aparecerán al elegirlo como médico responsable de una receta.
4. Marque **puede autogenerar token** solo si debe poder abrir expedientes sin depender del Administrador.
5. Presione **Crear usuario**. Indique a la persona que cambie su contraseña temporal al primer ingreso.

### 12.2 Editar roles y permisos
En la tabla de usuarios:
- **Roles**: cambie la selección de roles del usuario; se guarda al cambiarla. El usuario debe **cerrar sesión e iniciarla de nuevo** para que el cambio surta efecto; su sesión actual conserva los roles anteriores hasta 8 horas.
- **RF-34**: marque la casilla para permitir que el usuario autogenere sus tokens.
- **Colegiado y especialidad** (solo personal de Consulta): se guardan al salir del campo.

### 12.3 Emitir un token para un usuario (RF-33)
1. En el bloque **Emitir token de acceso temporal**, seleccione el **usuario** que lo recibirá (los administradores no aparecen en la lista).
2. Presione **Generar token**.
3. Copie el token que aparece y entréguelo a esa persona por un canal seguro. Vence en 15 minutos y es de un solo uso.

---

## 13. Reportes

Ruta del menú: **Reportes**. Solo para el Administrador. Seleccione el rango de fechas (*Desde* y *Hasta*) para los reportes que lo requieran:

| Reporte | Contenido |
|---|---|
| Financiero | Ingresos de hospital y farmacia, gastos, impuesto estimado e ingreso neto. |
| Ingresos por mes | Ingresos agrupados por día, semana o mes. |
| Admisiones | Admisiones por condición de egreso. |
| Facturación por forma de pago | Totales por efectivo y transferencia. |
| Kardex de farmacia | Entradas y salidas de inventario. |
| Auditoría del diagnóstico | Quién vio o registró cada diagnóstico confidencial, y cuándo. |
| Actividad | Bitácora general de acciones (inicios de sesión, altas, cambios) filtrable por acción. |

---

## 14. Escaneo desde el teléfono (paso a paso)

1. En **Registro y Admisión → + Paciente nuevo**, presione **Escanear con el teléfono**.
2. Aparece un código QR con un plazo de 10 minutos.
3. Con el teléfono, lea el QR. Se abre una página del sistema (no necesita iniciar sesión).
4. Tome las fotos de las hojas del expediente y envíelas.
5. En la computadora, el documento aparece en el formulario. Revise y guarde el paciente.

Si el QR venció, cancele la sesión y genere otra.

---

## 15. Mensajes frecuentes y qué hacer

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| "No tiene permiso para esta accion" | Su rol no puede realizar esa acción. | Pida la acción a un usuario con el rol correspondiente o al Administrador. |
| "Requiere token de acceso temporal" | El diagnóstico necesita un token. | Obtenga un token (sección 3.1). |
| "El token ha expirado" / "El token ya fue utilizado" | El token venció o se usó. | Solicite o genere uno nuevo. |
| "Token invalido" / "El token no pertenece a este usuario" | El token es de otra persona o de otro paciente. | Solicite un token para su usuario y el paciente correcto. |
| "Ya existe un paciente con este DPI" | El paciente ya está registrado. | Búsquelo en Pacientes registrados. |
| "La historia clínica ... ya está asignada" | Otro paciente tiene ese número. | Revise el número o busque al paciente existente. |
| "Tipo de archivo no permitido" | El archivo no es PDF, PNG o JPG. | Convierta el archivo al formato permitido. |
| "El archivo excede el tamaño máximo permitido" o "El archivo excede el máximo de 20 MB" | Supera el límite (5 MB en estudios, 20 MB en documentos). | Reduzca el tamaño o divídalo. |
| "Stock insuficiente" | No hay existencias suficientes. | Revise el inventario y registre una entrada si corresponde. |
| "Sesión no encontrada o expirada" (escaneo) | El QR venció. | Genere una nueva sesión de escaneo. |
| "Demasiados intentos" | Se superó el límite de intentos. | Espere el tiempo indicado. |
| "Token invalido o expirado" (al navegar) | La sesión venció. | Inicie sesión de nuevo. |

Si un problema persiste, reporte el mensaje exacto, la hora y la pantalla al Administrador del sistema.

---

## 16. Buenas prácticas de seguridad y confidencialidad

- No comparta su usuario ni su contraseña. Cierre la sesión al terminar, sobre todo en computadoras compartidas.
- No deje sin supervisión un diagnóstico abierto ni un token copiado en una nota.
- Todo acceso al diagnóstico queda registrado a su nombre y puede ser auditado por el Administrador.
- Revise siempre los datos que el sistema rellena automáticamente a partir de un escaneo antes de guardar.
- Los datos de pacientes son confidenciales. No los comparta por canales no autorizados ni los imprima sin necesidad.
