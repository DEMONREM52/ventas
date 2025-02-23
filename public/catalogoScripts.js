
    let totalCarrito = 0; // Variable para almacenar el total del carrito
   let totalGeneral = 0; // Variable para almacenar el total general de todos los productos
   
   // Event listeners para los radio buttons
   document.querySelectorAll('input[name="opcion"]').forEach(radio => {
       radio.addEventListener('change', () => {
           // Llamar a la función para recalcular el total del carrito cada vez que cambie la selección de radio
           calcularTotal();
       });
   });
   
   function agregarAlCarrito(productoId, nombreProducto, precioProducto, cantidad) {
       // Verificar si el producto ya está en el carrito
       const productoEnCarrito = document.querySelector(`#lista-carrito [data-producto-id="${productoId}"]`);
       if (productoEnCarrito) {
           const cantidadActual = parseInt(productoEnCarrito.querySelector('.cantidad').textContent);
           productoEnCarrito.querySelector('.cantidad').textContent = cantidadActual + parseInt(cantidad);
           Swal.fire({
               icon: 'info',
               title: 'Producto ya agregado',
               text: 'Este producto ya se encuentra en el carrito.'
           });
           
           // Eliminar el input de cantidad y el botón de agregar al carrito
           const agregarAlCarritoForm = document.querySelector(`form.agregar-al-carrito[data-producto-id="${productoId}"]`);
           if (agregarAlCarritoForm) {
               agregarAlCarritoForm.remove();
           }
           
           return;
       }
   
       // Mostrar Sweet Alert para ingresar la cantidad
       Swal.fire({
        title: '🛒 Ingrese la cantidad',
    text: '⚠️ Por favor, ten en cuenta que los detalles de tu pedido pueden cambiar la cantidad que has seleccionado anteriormente. \n🛍️ Asegúrate de revisar tu carrito de compras para agregar o quitar productos según sea necesario. \nPor favor, ingresa de nuevo la cantidad deseada.',
    input: 'number',
    inputAttributes: {
        min: '1',
        value: '1'
    },
    confirmButtonText: '🛒 Agregar al carrito',
    cancelButtonText: '❌ Cancelar',
    showCancelButton: true,
           inputValidator: (value) => {
               if (!value || value < 1) {
                   return 'Por favor, ingrese una cantidad válida.';
               }
           }
       }).then((result) => {
           if (result.isConfirmed) {
               const cantidad = parseInt(result.value);
               const totalProducto = parseFloat(precioProducto) * cantidad;
   
               let totalRadio = 0;
               const opcionSeleccionada = document.querySelector('input[name="opcion"]:checked');
               if (opcionSeleccionada) {
                   totalRadio = parseFloat(opcionSeleccionada.value);
               }
   
               totalCarrito += totalProducto;
               totalGeneral += totalProducto;
   
               const itemCarrito = `
       <li class="item-factura" data-producto-id="${productoId}">
           <div class="nombre">${nombreProducto}</div>
           <div class="detalle-producto">
               <div>
                   Precio: <span class="precio">${precioProducto.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</span>
               </div>
               <div>
                   Cantidad: <span class="cantidad">${cantidad}</span>
               </div>
               <div>
                   Subtotal: <span class="total">${totalProducto.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</span>
               </div>
               <div class="cantidad-controls">
                   <button class="decrementar-cantidad" onclick="modificarCantidad('${productoId}', ${precioProducto}, -1)"><span>-</span></button>
                   <input type="number" class="cantidad-extra" value="1" min="1">
                   <button class="agregar-extra" onclick="modificarCantidad('${productoId}', ${precioProducto}, 1)"><span>+</span></button>
               </div>
               <button class="boton-eliminar-lista" onclick="eliminarDelCarrito('${productoId}', ${precioProducto}, ${cantidad})">Eliminar</button>
           </div>
       </li>
   `;
   
               const listaCarrito = document.getElementById('lista-carrito');
               listaCarrito.insertAdjacentHTML('beforeend', itemCarrito);
   
               calcularTotal();
               actualizarTotalGeneral();
               guardarCarritoEnLocalStorage();
           }
       });
   }
   
   
   
   
   
   function modificarCantidad(productoId, precioProducto, cambio) {
       const productoEnCarrito = document.querySelector(`#lista-carrito [data-producto-id="${productoId}"]`);
       const cantidadExtra = parseInt(productoEnCarrito.querySelector('.cantidad-extra').value);
   
       if (isNaN(cantidadExtra) || cantidadExtra < 0) {
           Swal.fire({
               icon: 'error',
               title: 'Error',
               text: 'Ingrese una cantidad válida.'
           });
           return;
       }
   
       let cantidadActual = parseInt(productoEnCarrito.querySelector('.cantidad').textContent);
       const nuevaCantidad = cantidadActual + cambio * cantidadExtra;
       if (nuevaCantidad < 1) {
           Swal.fire({
               icon: 'error',
               title: 'Error',
               text: 'La cantidad mínima es 1. Si deseas eliminar el producto, usa el botón Eliminar.'
           });
           return;
       }
   
       const nuevoTotal = parseFloat(precioProducto) * nuevaCantidad;
   
       productoEnCarrito.querySelector('.cantidad').textContent = nuevaCantidad;
       productoEnCarrito.querySelector('.total').textContent = nuevoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
   
       totalCarrito = recalcularTotal(); // Actualizar el total del carrito
       totalGeneral = recalcularTotal(); // Actualizar el total general
   
       guardarCarritoEnLocalStorage(); // Guardar el carrito en localStorage
       calcularTotal(); // Calcular y mostrar el total del carrito
       actualizarTotalGeneral(); // Actualizar el total general mostrado
   }
   
   
   function recalcularTotal() {
       let nuevoTotal = 0;
   
       document.querySelectorAll('#lista-carrito li').forEach(item => {
           const totalProducto = parseFloat(item.querySelector('.total').textContent.replace(/[^\d.-]/g, ''));
           if (!isNaN(totalProducto)) {
               nuevoTotal += totalProducto;
           }
       });
   
       return nuevoTotal;
   }
   
   function calcularTotal() {
       totalCarrito = 0;
   
       document.querySelectorAll('#lista-carrito li').forEach(item => {
           const totalProducto = parseFloat(item.querySelector('.total').textContent.replace(/[^\d-]/g, ''));
           if (!isNaN(totalProducto)) {
               totalCarrito += totalProducto;
           }
       });
   
       const opcionSeleccionada = document.querySelector('input[name="opcion"]:checked');
       if (opcionSeleccionada) {
           const valorRadio = parseFloat(opcionSeleccionada.value);
           if (!isNaN(valorRadio)) {
               totalCarrito += valorRadio;
           }
       }
   
       const totalCarritoElement = document.getElementById('total-carrito');
       totalCarritoElement.textContent = `Total a pagar: ${totalCarrito.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`;
       totalCarritoElement.style.display = 'block';
   
       guardarCarritoEnLocalStorage();
       guardarTotalAPagarEnLocalStorage(totalCarrito);
   }
   
   function guardarTotalAPagarEnLocalStorage(totalAPagar) {
       localStorage.setItem('totalAPagar', totalAPagar);
   }
   
   // Event listener para los formularios de agregar al carrito
   document.querySelectorAll('.agregar-al-carrito').forEach(form => {
       form.addEventListener('submit', (event) => {
           event.preventDefault(); // Evitar que el formulario se envíe por defecto
   
           const formData = new FormData(form);
           const productoId = formData.get('productoId');
           const nombreProducto = formData.get('nombreProducto');
           const precioProducto = parseFloat(formData.get('precioProducto'));
           let cantidad = parseInt(formData.get('cantidad'));
   
           // Verificar si ya existe un registro para este producto en el carrito
           const productoEnCarrito = document.querySelector(`#lista-carrito [data-producto-id="${productoId}"]`);
           if (productoEnCarrito) {
               const cantidadAnterior = parseInt(productoEnCarrito.querySelector('.cantidad').value);
               const precioAnterior = parseFloat(productoEnCarrito.querySelector('.precio').textContent.replace(/[^\d.-]/g, '')); // Eliminar cualquier caracter que no sea número, punto o signo negativo
               totalCarrito -= precioAnterior * cantidadAnterior; // Restar el total del producto anterior
               totalGeneral -= precioAnterior * cantidadAnterior; // Restar el total general del producto anterior
               cantidad += cantidadAnterior; // Sumar la cantidad anterior a la nueva cantidad
               productoEnCarrito.remove(); // Eliminar el registro anterior del carrito
           }
   
           agregarAlCarrito(productoId, nombreProducto, precioProducto, cantidad);
       });
   });
   
   
   // Función para actualizar la cantidad de un producto en el carrito
   function actualizarCantidad(productoId, precioProducto) {
       const cantidadElement = document.querySelector(`#lista-carrito [data-producto-id="${productoId}"] .cantidad`);
       const nuevaCantidad = parseInt(cantidadElement.value);
       const totalAnterior = parseFloat(cantidadElement.parentElement.querySelector('.total').textContent.replace(/[^\d.-]/g, '')); // Eliminar cualquier caracter que no sea número, punto o signo negativo
       const nuevoTotal = precioProducto * nuevaCantidad;
       totalCarrito -= totalAnterior; // Restar el total del producto anterior del carrito
       totalCarrito += nuevoTotal; // Sumar el nuevo total del producto al carrito
       totalGeneral -= totalAnterior; // Restar el total general del producto anterior
       totalGeneral += nuevoTotal; // Sumar el nuevo total del producto al total general
       cantidadElement.parentElement.querySelector('.total').textContent = nuevoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }); // Actualizar el total del producto
       calcularTotal(); // Calcular y mostrar el total del carrito
       actualizarTotalGeneral(); // Actualizar el total general mostrado
       guardarCarritoEnLocalStorage(); // Guardar el carrito en localStorage
   }
   
   // Función para eliminar un producto del carrito
   function eliminarDelCarrito(productoId, precioProducto, cantidad) {
       // Calcular el total por producto
       const totalProducto = precioProducto * cantidad;
   
       // Restar el total del producto del carrito
       totalCarrito -= totalProducto;
   
       // Restar el total general del producto
       totalGeneral -= totalProducto;
   
       // Seleccionar el producto en el carrito
       const productoEnCarrito = document.querySelector(`#lista-carrito [data-producto-id="${productoId}"]`);
   
       // Mostrar Sweet Alert para confirmar la eliminación del producto
       Swal.fire({
           title: '¿Estás seguro?',
           text: '¿Deseas eliminar este producto del carrito?',
           icon: 'warning',
           showCancelButton: true,
           confirmButtonColor: '#3085d6',
           cancelButtonColor: '#d33',
           confirmButtonText: 'Sí, eliminar',
           cancelButtonText: 'Cancelar'
       }).then((result) => {
           if (result.isConfirmed) {
               // Si el usuario confirma la eliminación, eliminar el producto del carrito
               productoEnCarrito.remove(); // Eliminar el registro del carrito
   
               // Actualizar el total mostrado en el carrito
               calcularTotal(); // Calcular y mostrar el total del carrito
               actualizarTotalGeneral(); // Actualizar el total general mostrado
               guardarCarritoEnLocalStorage(); // Guardar el carrito actualizado en localStorage
   
               // Mostrar un Sweet Alert para confirmar la eliminación
               Swal.fire(
                   'Eliminado!',
                   'El producto ha sido eliminado del carrito.',
                   'success'
               );
           }
       });
   }
   
   
   // Función para cargar el carrito desde localStorage
   function cargarCarritoDesdeLocalStorage() {
       const carritoGuardado = localStorage.getItem('carrito');
       const totalCarritoData = localStorage.getItem('totalCarritoData');
   
       if (carritoGuardado && totalCarritoData) {
           // Restaurar el contenido del carrito
           const listaCarrito = document.getElementById('lista-carrito');
           listaCarrito.innerHTML = JSON.parse(carritoGuardado);
   
           // Restaurar los totales
           const totales = JSON.parse(totalCarritoData);
           totalCarrito = totales.totalCarrito;
           totalGeneral = totales.totalGeneral;
   
           const totalAPagarGuardado = localStorage.getItem('totalAPagar');
       if (totalAPagarGuardado) {
           totalCarrito = parseFloat(totalAPagarGuardado);
           const totalCarritoElement = document.getElementById('total-carrito');
           totalCarritoElement.textContent = `Total a pagar: ${totalCarrito.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`;
           totalCarritoElement.style.display = 'block';
       }
   
           // Actualizar los totales en la interfaz
           actualizarTotalGeneral();
           calcularTotal();
       }
   }
   // Función para guardar el carrito en localStorage
   function guardarCarritoEnLocalStorage() {
       const listaCarrito = document.getElementById('lista-carrito');
       const carritoHTML = listaCarrito.innerHTML;
       const totalCarritoData = {
           totalCarrito: totalCarrito,
           totalGeneral: totalGeneral
       };
   
       localStorage.setItem('carrito', JSON.stringify(carritoHTML));
       localStorage.setItem('totalCarritoData', JSON.stringify(totalCarritoData));
   }
   // Función para limpiar el carrito de localStorage
   function limpiarCarritoDeLocalStorage() {
       localStorage.removeItem('carrito');
       localStorage.removeItem('totalCarritoData');
   }
   // Cargar el carrito desde localStorage al iniciar la página
   document.addEventListener('DOMContentLoaded', () => {
       cargarCarritoDesdeLocalStorage();
   });
   
   


    // Guardar datos del formulario en localStorage
function guardarDatosFormulario() {
  const nombre = document.getElementById('nombre').value;
  const direccion = document.getElementById('direccion').value;
  const tarifaEnvio = document.querySelector('input[name="opcion"]:checked').value;

  localStorage.setItem('nombre', nombre);
  localStorage.setItem('direccion', direccion);
  localStorage.setItem('tarifaEnvio', tarifaEnvio);
}

// Cargar datos del formulario desde localStorage
function cargarDatosFormulario() {
  const nombre = localStorage.getItem('nombre');
  const direccion = localStorage.getItem('direccion');
  const tarifaEnvio = localStorage.getItem('tarifaEnvio');

  document.getElementById('nombre').value = nombre || '';
  document.getElementById('direccion').value = direccion || '';

  if (tarifaEnvio) {
    document.querySelector(`input[value="${tarifaEnvio}"]`).checked = true;
  }
}

// Event listener para guardar los datos del formulario cuando cambian
document.querySelectorAll('.carrito').forEach(input => {
  input.addEventListener('input', guardarDatosFormulario);
});

// Cargar los datos del formulario cuando se carga la página
document.addEventListener('DOMContentLoaded', cargarDatosFormulario);



    // Función para mostrar u ocultar el carrito
    function toggleCarrito() {
        const carrito = document.getElementById('carrito');
        if (carrito.style.display === 'none') {
            carrito.style.display = 'block';
            setTimeout(() => {
                carrito.style.opacity = '1';
                carrito.style.transform = 'scale(1)';
            }, 50); // Espera un breve momento antes de aplicar la transición para dar tiempo a que el cambio de visibilidad ocurra
        } else {
            carrito.style.opacity = '0';
            carrito.style.transform = 'scale(0)';
            setTimeout(() => {
                carrito.style.display = 'none';
            }, 300); // Espera 300 ms (la duración de la transición CSS) antes de ocultar completamente el carrito
        }
    }
// Función para comprar con el asesor
function comprar(asesor) {
    verificarHorario(asesor);
}

// Función para verificar el horario y el día
function verificarHorario(asesor) {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0 para Domingo, 1 para Lunes, ..., 6 para Sábado
    const hora = ahora.getHours();

    if (diaSemana === 0 || hora < 8 || hora >= 18) {
        // Si es Domingo o la hora es antes de las 8:00AM o después de las 6:00PM
        Swal.fire({
            icon: 'info',
            title: 'Horario de atención',
            text: 'Nuestro horario de atención es de lunes a sábado, de 8:00 a.m. a 6:00 p.m. No obstante, puedes realizar tus pedidos en cualquier momento. Tan pronto como nuestros asesores estén disponibles, responderán a tu solicitud. ¡Gracias por tu comprensión!'
        }).then((result) => {
            // Llamar a la función para realizar la compra sin importar el horario
            realizarCompra(asesor);
        });
    } else {
        // Si es dentro del horario de atención, proceder con la compra directamente
        realizarCompra(asesor);
    }
}

// Función para realizar la compra con el asesor
function realizarCompra(asesor) {
    // Verificar si el carrito está vacío
    const listaCarrito = document.getElementById('lista-carrito');
    if (listaCarrito.children.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Carrito vacío',
            text: 'El carrito está vacío. Por favor, agregue productos antes de continuar.'
        });
        return;
    }

    // Verificar si se ha ingresado un nombre
    const nombre = document.getElementById('nombre').value;
    if (!nombre) {
        Swal.fire({
            icon: 'warning',
            title: 'Nombre requerido',
            text: 'Por favor, ingrese su nombre antes de continuar.'
        });
        return;
    }

    // Obtener el valor del radio button seleccionado
    const opcionSeleccionada = document.querySelector('input[name="opcion"]:checked');
    if (!opcionSeleccionada) {
        Swal.fire({
            icon: 'warning',
            title: 'Tarifa de envio requerida',
            text: 'Por favor, seleccione una opción antes de continuar.'
        });
        return;
    }
    const valorRadio = opcionSeleccionada.value;

    // Obtener el contenido del textarea
    const direccion = document.getElementById('direccion').value;

    // Verificar si se ha ingresado la dirección
    if (!direccion.trim()) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos requeridos',
            text: 'Por favor, ingrese su dirección antes de continuar.'
        });
        return;
    }

    // Obtener el texto de la tarifa de envío
    const labelSeleccionado = document.querySelector(`label[for="${opcionSeleccionada.id}"]`);
    const textoLabel = labelSeleccionado.textContent;

    // Números de WhatsApp para cada asesor
    const numerosWhatsApp = {
        'Natalia Giraldo': '+573124304627',
        'Luis Velasquez': '+573203331291',
        'Cristian Zuñiga': '+573134843987',
        'Mariana Zapata': '+573145657107'
    };

    // Número de WhatsApp del asesor seleccionado
    const numeroWhatsApp = numerosWhatsApp[asesor];

    // Construir el mensaje con los detalles de la compra
    let mensaje = `¡Hola ${nombre}!\n¿Quieres realizar una compra?\nTu pedido es:\n\n`;
   
   
   
Array.from(listaCarrito.children).forEach(item => {
    const nombreProducto = item.querySelector('.nombre').textContent.trim(); // Extraer el nombre del producto del texto
    const cantidad = parseInt(item.querySelector('.cantidad').textContent, 10); // Obtener la cantidad del producto y convertir a número entero
    const totalText = item.querySelector('.total').textContent.replace(/[^\d.,-]/g, ''); // Eliminar caracteres no numéricos
    const total = parseFloat(totalText.replace(',', '.').replace(/\./g, '')); // Formatear correctamente el número

    if (!isNaN(cantidad) && !isNaN(total) && cantidad > 0) { // Verificar que cantidad y total sean válidos
        const precioUnitario = (total / cantidad).toFixed(0); // Calcular el precio unitario y redondear
        const totalFormatted = total.toLocaleString('es-CO', { minimumFractionDigits: 0 }); // Formatear el total

        mensaje += `*▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬*\n*${nombreProducto}*\nCantidad: ${cantidad}\nPrecio unitario: $${precioUnitario.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}\n*Subtotal: $${totalFormatted.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}*\n\n`;

        totalGeneral += total; // Sumar el subtotal al total general
    }
});


    // Agregar la opción seleccionada del radio button al mensaje
    mensaje += `Tarifa de envío: ${textoLabel}\n\n`;

    // Agregar el contenido del textarea al mensaje
    mensaje += `Tus datos de envío son: ${direccion}\n`;

    // Agregar el total a pagar al mensaje
    const totalAPagar = document.getElementById('total-carrito').textContent;
    mensaje += `\n*${totalAPagar}*\n¿Tu pedido está correcto?\nSI/NO\n`;

    // Codificar el mensaje para que sea compatible con la URL
    const mensajeCodificado = encodeURIComponent(mensaje);

    // Construir la URL de WhatsApp
    const url = `https://wa.me/${numeroWhatsApp}/?text=${mensajeCodificado}`;

    // Abrir la URL en una nueva pestaña
    window.open(url, '_blank');
}


function comprarNatalia() {
    comprar('Natalia Giraldo');
}

function comprarLuis() {
    comprar('Luis Velasquez');
}

function comprarCristian() {
    comprar('Cristian Zuñiga');
}

function comprarMariana() {
    comprar('Mariana Zapata');
}





// Función para limpiar el carrito y el almacenamiento local
function limpiarCarritoYLocalStorage() {
    Swal.fire({
        title: '¿Está seguro?',
        text: '¿Desea limpiar el carrito?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
    }).then((result) => {
        if (result.isConfirmed) {
            // Limpiar el carrito
            limpiarCarrito();
        }
    });
}

// Función para limpiar el carrito
function limpiarCarrito() {
    // Limpiar la lista del pedido en el DOM
    const listaCarrito = document.getElementById('lista-carrito');
    listaCarrito.innerHTML = '';

    // Limpiar el total del carrito en el DOM
    const totalCarritoElement = document.getElementById('total-carrito');
    totalCarritoElement.style.display = 'none';

    // Limpiar el carrito del almacenamiento local
    limpiarCarritoEnLocalStorage();

    // Informar al usuario que el carrito se ha limpiado
    Swal.fire({
        icon: 'success',
        title: 'Carrito limpiado',
        text: 'El carrito se ha limpiado correctamente.'
    });
}

// Función para limpiar el carrito en el almacenamiento local
function limpiarCarritoEnLocalStorage() {
    localStorage.removeItem('carrito');
    localStorage.removeItem('totalCarritoData');
}




    var prevScrollpos = window.pageYOffset;
    window.onscroll = function () {
        var currentScrollPos = window.pageYOffset;
        if (prevScrollpos > currentScrollPos) {
            document.getElementById("navbar").style.top = "0";
            document.getElementById("navbar").style.opacity = "1"; // Restablece la opacidad al hacer scroll hacia arriba
        } else {
            document.getElementById("navbar").style.top = "-65px";
            document.getElementById("navbar").style.opacity = "0.5"; // Cambia la opacidad al hacer scroll hacia abajo
        }
        document.getElementById("navbar").style.transition = "top 0.6s, opacity 0.6s"; // Aplica transición suave
        prevScrollpos = currentScrollPos;
    }


// Obtener el input de búsqueda y el contenedor de sugerencias
var inputBusqueda = document.getElementById('buscador');
var sugerenciasContainer = document.getElementById('sugerencias');

// Lista de sugerencias para cada página
const suggestionsDataByPage = {
    'belleza': [
        "Cépillo",
        "Secadores"
    ],
    'deporte': [
        "Banda"
    ]
};

// Determinar la página actual (por ejemplo, usando la URL)
const pageIdentifier = window.location.pathname.split('/').pop(); // O usa otro método para identificar la página
const suggestionsData = suggestionsDataByPage[pageIdentifier] || [];

// Función para eliminar diacríticos y caracteres especiales
function eliminarDiacriticos(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
}

// Función para buscar coincidencias parciales (no consecutivas)
function coincideBusqueda(nombre, palabrasBusqueda) {
    return palabrasBusqueda.every(palabra => nombre.includes(palabra));
}

// Evento para mostrar sugerencias al escribir en el input
inputBusqueda.addEventListener('input', function() {
    var valorBusqueda = eliminarDiacriticos(inputBusqueda.value.trim().toLowerCase());
    var palabrasBusqueda = valorBusqueda.split(" ").filter(word => word);  // Dividir en palabras

    // Mostrar sugerencias que coincidan con el valor de búsqueda
    mostrarSugerencias(valorBusqueda);

    // Filtrar y mostrar/ocultar los elementos según el valor de búsqueda y precio
    filtrarProductos(palabrasBusqueda);
});

// Función para mostrar las sugerencias disponibles
function mostrarSugerencias(valorBusqueda) {
    sugerenciasContainer.innerHTML = '';

    // Filtrar las sugerencias de ejemplo según el valor de búsqueda
    const filteredSuggestions = suggestionsData.filter(item => {
        var nombreSugerencia = eliminarDiacriticos(item.toLowerCase());
        return coincideBusqueda(nombreSugerencia, valorBusqueda.split(" ").filter(word => word));
    });

    // Mostrar las sugerencias filtradas
    filteredSuggestions.forEach(item => {
        const suggestionItem = document.createElement("li");
        suggestionItem.textContent = item;
        suggestionItem.classList.add("suggestion-item");

        suggestionItem.addEventListener("click", function() {
            inputBusqueda.value = item;
            sugerenciasContainer.classList.remove('show'); // Ocultar sugerencias al seleccionar una
            ejecutarBusqueda(); // Ejecutar búsqueda al seleccionar
        });

        sugerenciasContainer.appendChild(suggestionItem);
    });

    // Mostrar la lista de sugerencias si hay sugerencias disponibles
    if (filteredSuggestions.length > 0) {
        sugerenciasContainer.classList.add('show');
    } else {
        sugerenciasContainer.classList.remove('show');
    }
}

// Evento para ocultar sugerencias al hacer clic fuera del input de búsqueda
document.addEventListener('click', function(event) {
    if (!inputBusqueda.contains(event.target) && !sugerenciasContainer.contains(event.target)) {
        sugerenciasContainer.classList.remove('show');
    }
});

// Función para ejecutar la búsqueda
function ejecutarBusqueda() {
    var event = new Event('input');
    inputBusqueda.dispatchEvent(event);
}

// Función para filtrar los productos
const filtrarProductos = (palabrasBusqueda) => {
    const precioMin = parseInt(document.getElementById('precio-min').value.replace(/,/g, '')) || 0; // Valor mínimo
    const precioMax = parseInt(document.getElementById('precio-max').value.replace(/,/g, '')) || Infinity; // Valor máximo

    const catalogos = document.querySelectorAll('.contenedor-autos'); // Seleccionamos todos los productos

    catalogos.forEach(catalogo => {
        const precio = parseInt(catalogo.getAttribute('data-precio')); // Obtenemos el precio del producto
        const nombre = eliminarDiacriticos(catalogo.getAttribute('data-nombre').toLowerCase());

        // Verificamos si el precio está dentro del rango y si coincide con la búsqueda
        if (precio >= precioMin && precio <= precioMax && coincideBusqueda(nombre, palabrasBusqueda)) {
            catalogo.style.display = 'block'; // Mostramos el producto
        } else {
            catalogo.style.display = 'none'; // Ocultamos el producto
        }
    });
};

// Función para formatear el número como moneda con coma como separador de miles
const formatearNumero = (numero) => {
    return new Intl.NumberFormat('es-US').format(numero).replace(/\./g, ''); // Reemplazar punto por coma
};

// Función para manejar el evento de entrada y aplicar el formato
const manejarEntrada = (event) => {
    const input = event.target;
    let valorSinFormato = input.value.replace(/,/g, ''); // Eliminamos comas para trabajar con el número

    // Solo permitir números
    if (!/^\d*$/.test(valorSinFormato)) {
        input.value = input.value.slice(0, -1); // Si no es un número, eliminamos el último carácter
        return;
    }

    // Convertimos a número
    const numero = parseInt(valorSinFormato) || 0;

    // Formateamos el valor de entrada con comas
    input.value = formatearNumero(numero);

    // Filtrar productos en tiempo real, asegurándonos de usar también el input de búsqueda
    var palabrasBusqueda = eliminarDiacriticos(inputBusqueda.value.trim().toLowerCase()).split(" ").filter(word => word);
    filtrarProductos(palabrasBusqueda);
};

// Agregar eventos para filtrar en tiempo real
document.getElementById('precio-min').addEventListener('input', manejarEntrada);
document.getElementById('precio-max').addEventListener('input', manejarEntrada);




    document.addEventListener('DOMContentLoaded', function () {
        const botonesVerDetalles = document.querySelectorAll('.ver-detalles');
        const botonesMostrarMenos = document.querySelectorAll('.mostrar-menos');

        botonesVerDetalles.forEach((boton, index) => {
            boton.addEventListener('click', function (event) {
                event.preventDefault();
                const descripcion = this.parentElement.querySelector('.descripcion');
                const botonMostrarMenos = this.parentElement.querySelector('.mostrar-menos');

                descripcion.style.maxHeight = descripcion.scrollHeight + 'px';
                botonMostrarMenos.style.display = 'inline-block';
                this.style.display = 'none';
            });
        });

        botonesMostrarMenos.forEach((boton) => {
            boton.addEventListener('click', function (event) {
                event.preventDefault();
                const descripcion = this.parentElement.querySelector('.descripcion');
                const botonVerDetalles = this.parentElement.querySelector('.ver-detalles');

                descripcion.style.maxHeight = '0';
                botonVerDetalles.style.display = 'inline-block';
                this.style.display = 'none';
            });
        });
    });



    document.addEventListener('DOMContentLoaded', function () {
        const botonesVerDetalles = document.querySelectorAll('.ver-terminos_garantia');
        const botonesMostrarMenos = document.querySelectorAll('.ocultar-terminos_garantia');

        botonesVerDetalles.forEach((boton, index) => {
            boton.addEventListener('click', function (event) {
                event.preventDefault();
                const descripcion = this.parentElement.querySelector('.terminos_garantia');
                const botonMostrarMenos = this.parentElement.querySelector('.ocultar-terminos_garantia');

                descripcion.style.maxHeight = descripcion.scrollHeight + 'px';
                botonMostrarMenos.style.display = 'inline-block';
                this.style.display = 'none';
            });
        });

        botonesMostrarMenos.forEach((boton) => {
            boton.addEventListener('click', function (event) {
                event.preventDefault();
                const descripcion = this.parentElement.querySelector('.terminos_garantia');
                const botonVerDetalles = this.parentElement.querySelector('.ver-terminos_garantia');

                descripcion.style.maxHeight = '0';
                botonVerDetalles.style.display = 'inline-block';
                this.style.display = 'none';
            });
        });
    });

