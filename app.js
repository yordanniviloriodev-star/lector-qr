// =====================================================
// Módulo Lector QR de cédula
// Lee el QR de la cédula con la CÁMARA o con un LECTOR EXTERNO,
// extrae el número (sin guiones) y lo envía al segundo input
// seguido de Alt+013 (Enter).
// Formato del QR: CEDULA|NOMBRES|APELLIDO1|APELLIDO2|CODIGO
// =====================================================

// ----- 1. Referencias a los elementos del HTML -----
const btnIniciar = document.getElementById("btnIniciar");
const btnDetener = document.getElementById("btnDetener");
const estado = document.getElementById("estado");
const formLector = document.getElementById("formLector");
const inputLeido = document.getElementById("inputLeido");
const inputDestino = document.getElementById("inputDestino");
const formDestino = document.getElementById("formDestino");
const historial = document.getElementById("historial");

// ----- 2. Constantes y variables -----
const ALT_013 = String.fromCharCode(13);   // Carácter 13 = retorno de carro (Enter)
let ultimaLectura = "";
let ultimoTiempo = 0;
let origenActual = "Manual";               // Quién envió la última cédula: Cámara, Lector externo o Manual

// ----- 3. Crear el lector de cámara (si la librería cargó) -----
let lector = null;
if (typeof Html5Qrcode !== "undefined") {
  lector = new Html5Qrcode("lector");      // Usa el <div id="lector">
} else {
  // Si la red bloquea la librería, la cámara no funciona, pero el lector externo sí
  btnIniciar.disabled = true;
  estado.textContent = "⚠️ No cargó la librería de la cámara. Puede usar el lector externo.";
}

// ----- 4. Extraer la cédula del texto leído -----
function extraerCedula(texto) {
  const limpio = texto.trim();                        // Quita espacios al inicio y al final

  // Primera posición que NO es número ni guion (normalmente el "|").
  // Así funciona aunque el lector externo escriba otro símbolo en vez de "|".
  let posicion = limpio.search(/[^\d-]/);
  if (posicion === -1) {
    posicion = limpio.length;                         // Si no hay separador, tomamos todo
  }

  const segmento = limpio.substring(0, posicion);     // Cortamos desde 0 hasta el separador
  const cedula = segmento.replace(/\D/g, "");         // Quitamos guiones y todo lo que no sea número

  if (cedula.length !== 11) {                         // Una cédula dominicana tiene 11 dígitos
    return null;
  }
  return cedula;
}

// ----- 5. Enviar la cédula al segundo input + Alt+013 -----
function enviarAlSegundoInput(cedula) {
  inputDestino.value = cedula;                        // Escribimos la cédula en el segundo input
  inputDestino.focus();                               // Ponemos el cursor ahí

  const valorConAlt013 = cedula + ALT_013;            // Valor completo: cédula + carácter 13

  // Simulamos que alguien presionó la tecla Enter sobre el input
  const teclaEnter = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true
  });
  inputDestino.dispatchEvent(teclaEnter);

  // Un Enter simulado no envía el formulario solo, así que lo enviamos nosotros
  formDestino.requestSubmit();

  return valorConAlt013;
}

// ----- 6. Procesar un texto leído (lo usan la cámara y el lector externo) -----
function procesarTexto(texto, origen) {
  inputLeido.value = texto;                           // Primer input: texto completo

  const cedula = extraerCedula(texto);
  if (cedula === null) {
    estado.textContent = "⚠️ El código leído no contiene una cédula válida";
    prepararLectorExterno();
    return;
  }

  origenActual = origen;
  enviarAlSegundoInput(cedula);
  estado.textContent = "✅ Cédula leída (" + origen + "): " + cedula;
  prepararLectorExterno();
}

// Deja el cursor en el primer input y su texto seleccionado:
// así la próxima lectura del lector externo reemplaza la anterior
function prepararLectorExterno() {
  inputLeido.focus();
  inputLeido.select();
}

// ----- 7. Lectura con la CÁMARA -----
function alLeerQR(textoLeido) {
  // La cámara lee unas 10 veces por segundo: ignoramos el mismo QR durante 3 segundos
  const ahora = Date.now();
  if (textoLeido === ultimaLectura && ahora - ultimoTiempo < 3000) {
    return;
  }
  ultimaLectura = textoLeido;
  ultimoTiempo = ahora;

  procesarTexto(textoLeido, "Cámara");
}

// ----- 8. Lectura con el LECTOR EXTERNO -----
// El lector externo "escribe" como un teclado y al final envía Enter,
// lo que dispara el envío (submit) de este formulario.
formLector.addEventListener("submit", function (evento) {
  evento.preventDefault();                            // Evita que la página se recargue
  const texto = inputLeido.value;
  if (texto.trim() === "") {
    return;                                           // Enter sin texto: no hacemos nada
  }
  procesarTexto(texto, "Lector externo");
});

// ----- 9. Encender la cámara -----
async function iniciarCamara() {
  if (lector === null) {
    return;
  }
  try {
    estado.textContent = "Solicitando permiso para usar la cámara...";
    await lector.start(
      { facingMode: "environment" },                  // Cámara trasera si existe (celular)
      { fps: 10, qrbox: 250 },                        // 10 lecturas por segundo, recuadro de 250px
      alLeerQR                                        // Función que se ejecuta al leer un QR
    );
    btnIniciar.disabled = true;
    btnDetener.disabled = false;
    estado.textContent = "📷 Cámara encendida: acerque el QR de la cédula";
  } catch (error) {
    estado.textContent = "❌ No se pudo abrir la cámara: " + error;
  }
}

// ----- 10. Apagar la cámara -----
async function detenerCamara() {
  try {
    await lector.stop();
  } catch (error) {
    console.error(error);
  }
  btnIniciar.disabled = false;
  btnDetener.disabled = true;
  estado.textContent = "Cámara apagada";
  prepararLectorExterno();
}

// ----- 11. Cuando se "presiona Enter" en el segundo input -----
formDestino.addEventListener("submit", function (evento) {
  evento.preventDefault();                            // Evita que la página se recargue

  const cedula = inputDestino.value;
  const hora = new Date().toLocaleTimeString();

  const item = document.createElement("li");
  item.textContent = hora + " → " + cedula + " + Alt+013 (" + origenActual + ")";
  historial.prepend(item);                            // La lectura más nueva va arriba

  origenActual = "Manual";                            // Si luego escriben a mano, se registra como Manual
});

// ----- 12. Conectar los botones con sus funciones -----
btnIniciar.addEventListener("click", iniciarCamara);
btnDetener.addEventListener("click", detenerCamara);
