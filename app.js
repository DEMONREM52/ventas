// Importar dependencias

// Biblioteca para mostrar alertas y mensajes modales en el navegador.
const Swal = require("sweetalert2");

// Framework web para Node.js que facilita la creación de aplicaciones web y APIs.
const express = require("express");

// Middleware para manejar sesiones de usuario en aplicaciones Express.
const session = require("express-session");

// Middleware para la autenticación de usuarios con diferentes estrategias (por ejemplo, local, OAuth).
const passport = require("passport");

// Middleware para analizar cuerpos de solicitudes HTTP en formatos como JSON o URL-encoded.
const bodyParser = require("body-parser");

// Biblioteca para conectar y consultar bases de datos MySQL desde Node.js.
const mysql = require("mysql2");

// Módulo para trabajar con rutas y rutas absolutas en el sistema de archivos.
const path = require("path");

// Biblioteca para encriptar contraseñas y manejar hashing seguro.
const bcrypt = require("bcryptjs");

// Motor de plantillas para renderizar vistas en el servidor con EJS.
const { render } = require("ejs");

// Middleware para manejar la carga de archivos en formularios HTTP (por ejemplo, subir imágenes).
const multer = require("multer");

// Biblioteca de procesamiento de imágenes para tareas como redimensionar y convertir formatos (comentada, no se usa actualmente).
// const sharp = require("sharp");

// Biblioteca para manipulación de imágenes en Node.js, como redimensionar y convertir formatos.
const Jimp = require("jimp");

// Módulo para interactuar con el sistema de archivos, permitiendo leer y escribir archivos.
const fs = require("fs");

const { exec } = require("child_process");
// Biblioteca para crear archivos comprimidos (zip) en Node.js.
const archiver = require("archiver");
const authenticate = require("./middleware/authenticate");

// Configuración de Express
const app = express();

// const port = process.env.PORT || 4000;
// const DB_HOST = process.env.DB_HOST || "localhost";
// const DB_USER = process.env.DB_USER || "root";
// const DB_PASSWORD = process.env.DB_PASSWORD || "";
// const DB_NAME = process.env.DB_NAME || "ventas_db";
// const DB_PORT = process.env.DB_PORT || "3306";

const port = process.env.PORT || 80;
const DB_HOST = process.env.DB_HOST || "ventas_database";
const DB_USER = process.env.DB_USER || "javier";
const DB_PASSWORD = process.env.DB_PASSWORD || "ae4f7b467325e599318e";
const DB_NAME = process.env.DB_NAME || "ventas"; 
const DB_PORT = process.env.DB_PORT || "3306"; 

app.use((err, req, res, next) => {
  console.error("Error en la aplicación:", err.stack);
  res.status(500).send("Error interno del servidor");
});


app.use(
  session({
    secret: "secret-key", // Cambia esto por una cadena de caracteres aleatoria y segura
    resave: false,
    saveUninitialized: true,
  })
);

// Agregar middleware para analizar el cuerpo de las peticiones como JSON
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.locals.usuario = req.user; // Pasar req.user a res.locals para que esté disponible en todas las plantillas
  next();
});
app.use(bodyParser.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10, // Número máximo de conexiones en el pool
  waitForConnections: true, // Permitir que las solicitudes esperen si no hay conexiones disponibles en el pool
  queueLimit: 0, // Sin límite en la cantidad de conexiones en la cola de espera
});

// Comprueba si la conexión al pool es exitosa
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error al conectar al pool de conexiones:", err);
    return;
  }
  console.log("Conexión exitosa al pool de conexiones MySQL");
  connection.release(); // Libera la conexión después de la prueba exitosa
});

// module.exports = pool; // Exporta el pool para usarlo en otras partes de tu aplicación
// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Ruta principal
app.get("/", verificarAccesoMayorista, (req, res) => {
  // Verifica si hay un parámetro "acceso" en la URL
  const acceso = req.query.acceso;

  // Si el parámetro acceso es "mayorista", configura la sesión de mayorista
  if (acceso === 'mayorista') {
      req.session.acceso = 'mayoristas';
      console.log('Sesión de mayorista configurada desde el enlace.');
      // Redirige a la misma página sin el parámetro
      return res.redirect('/');
  }

  // Obtener una conexión del pool de conexiones
  pool.getConnection((err, connection) => {
      if (err) {
          console.error("Error al obtener una conexión del pool:", err);
          return res.status(500).send("Error interno del servidor");
      }

      // Realizar la consulta SQL
      connection.query("SELECT * FROM catalogos", (err, results) => {
          // Liberar la conexión de vuelta al pool
          connection.release();

          if (err) {
              console.error("Error al obtener catálogos:", err);
              return res.status(500).send("Error interno del servidor");
          }

          const catalogos = results.map((producto) => ({
              ...producto,
              precio: req.esMayorista
                  ? producto.precio_mayorista
                  : producto.precio_detal,
          }));

          // Obtener el usuario de la sesión
          const usuario = req.session.usuario;

          // Renderizar la vista index.ejs y pasar los datos de los vehículos, el usuario y esMayorista
          res.render("index", {
              usuario: usuario,
              catalogos: catalogos,
              esMayorista: req.esMayorista,
          });
      });
  });
});

app.post("/guardar_sesion", (req, res) => {
  const { acceso } = req.body;

  // Si el acceso es "mayoristas", configura la sesión de mayorista
  if (acceso === "mayoristas") {
    req.session.acceso = "mayoristas";
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

function verificarAccesoMayorista(req, res, next) {
  req.esMayorista = req.session.acceso === "mayoristas";
  next();
}



app.use(verificarAccesoMayorista);

app.post("/destruir_sesion_mayoristas", (req, res) => {
  // Elimina la sesión de mayoristas
  if (req.session.acceso === "mayoristas") {
    delete req.session.acceso;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Ruta para renderizar la vista de catálogo
app.get("/catalogo", (req, res) => {
  // Verificar si el usuario ha iniciado sesión
  if (req.session.usuario) {
    // Obtener datos de catálogos y usuarios de la base de datos en paralelo
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error al obtener una conexión del pool:", err);
        res.status(500).send("Error interno del servidor");
        return;
      }

      // Realizar la primera consulta SQL para obtener los catálogos
      connection.query(
        "SELECT * FROM catalogos",
        (errCatalogos, resultadosCatalogos) => {
          if (errCatalogos) {
            connection.release(); // Liberar la conexión de vuelta al pool
            console.error(
              "Error interno del servidor al obtener catálogos:",
              errCatalogos
            );
            res
              .status(500)
              .send("Error interno del servidor al obtener catálogos");
            return;
          }

          // Realizar la segunda consulta SQL para obtener los usuarios
          connection.query(
            "SELECT id, nombre, email, rol, permiso_eliminar FROM usuarios",
            (errUsuarios, resultadosUsuarios) => {
              connection.release(); // Liberar la conexión de vuelta al pool

              if (errUsuarios) {
                console.error(
                  "Error interno del servidor al obtener usuarios:",
                  errUsuarios
                );
                res
                  .status(500)
                  .send("Error interno del servidor al obtener usuarios");
                return;
              }

              // Obtener el usuario de la sesión y sus datos completos
              const usuarioSesion = req.session.usuario;
              const usuarioCompleto =
                resultadosUsuarios.find((u) => u.id === usuarioSesion.id) ||
                usuarioSesion;

              // Renderizar la vista de catálogo y pasar los datos de catálogos, usuarios y usuarioActual
              res.render("catalogo", {
                catalogos: resultadosCatalogos,
                usuarios: resultadosUsuarios,
                usuario: usuarioCompleto, // Pasar el usuario completo con todos los campos incluido permiso_eliminar
                usuarioActual: usuarioCompleto.nombre, // Aquí deberías pasar el nombre del usuario actual
              });
            }
          );
        }
      );
    });
  } else {
    // Si el usuario no ha iniciado sesión, redirigir a la página de inicio de sesión
    res.redirect("/inicio-sesion");
  }
});

// Ruta POST para actualizar el permiso de eliminar
app.post("/cambiar-permiso/:id", (req, res) => {
  const usuarioId = req.params.id;
  const { permiso_eliminar } = req.body;

  // Actualizar el permiso de eliminación del usuario en la base de datos
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión del pool:", err);
      res.status(500).json({
        success: false,
        error: "Error al obtener una conexión del pool.",
      });
      return;
    }

    connection.query(
      "UPDATE usuarios SET permiso_eliminar = ? WHERE id = ?",
      [permiso_eliminar, usuarioId],
      (err, resultado) => {
        connection.release(); // Liberar la conexión de vuelta al pool

        if (err) {
          console.error(
            "Error al actualizar el permiso de eliminación del usuario:",
            err
          );
          res.status(500).json({
            success: false,
            error: "Error al actualizar el permiso de eliminación del usuario.",
          });
          return;
        }

        res.json({
          success: true,
          message: "Permiso de eliminar actualizado correctamente.",
        });
      }
    );
  });
});

app.post("/cambiar-contrasena/:id", async (req, res) => {
  const usuarioId = req.params.id;
  const nuevaContrasena = req.body.nuevaContrasena;

  try {
    // Generar el hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);

    // Actualizar la contraseña en la base de datos
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error al obtener una conexión del pool:", err);
        res.status(500).send("Error interno del servidor");
        return;
      }

      // Actualizar la contraseña del usuario
      connection.query(
        "UPDATE usuarios SET contraseña = ? WHERE id = ?",
        [hashedPassword, usuarioId],
        (err, resultado) => {
          connection.release(); // Liberar la conexión de vuelta al pool

          if (err) {
            console.error(
              "Error al actualizar la contraseña del usuario:",
              err
            );
            res.status(500).send("Error interno del servidor");
            return;
          }

          // Mostrar mensaje de confirmación utilizando SweetAlert
          res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
              Swal.fire({
                title: 'Contraseña actualizada',
                text: 'La contraseña se ha actualizado correctamente.',
                icon: 'success',
                confirmButtonText: 'OK'
              }).then(() => {
                window.location.href = "/catalogo";
              });
            </script>
          `);
          4;
        }
      );
    });
  } catch (error) {
    console.error("Error al hashear la contraseña:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Ruta para editar un usuario
app.get("/editar-usuario/:id", (req, res) => {
  const usuarioId = req.params.id;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión del pool:", err);
      res.status(500).send("Error interno del servidor");
      return;
    }

    // Realizar la consulta SQL para obtener la información del usuario con el ID proporcionado
    connection.query(
      "SELECT * FROM usuarios WHERE id = ?",
      [usuarioId],
      (err, result) => {
        connection.release(); // Liberar la conexión de vuelta al pool

        if (err) {
          console.error("Error al obtener información del usuario:", err);
          res.status(500).send("Error interno del servidor");
        } else {
          // Renderizar el formulario de edición de usuario y pasar los datos del usuario
          res.render("editar-usuario", {
            usuario: result[0],
            isAdmin: req.session.usuario.rol === "superadmin", // Verificar si el usuario es superadmin
          });
        }
      }
    );
  });
});

// Ruta para editar un usuario
app.post("/editar-usuario/:id", (req, res) => {
  const usuarioId = req.params.id;
  const { nombre: nuevoNombre, email, contraseña, rol } = req.body;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión del pool:", err);
      res.status(500).send("Error interno del servidor");
      return;
    }

    // Obtener el nombre actual del usuario
    connection.query(
      "SELECT nombre FROM usuarios WHERE id = ?",
      [usuarioId],
      (err, resultado) => {
        if (err) {
          connection.release(); // Liberar la conexión de vuelta al pool
          console.error("Error al obtener el nombre del usuario:", err);
          res.status(500).send("Error interno del servidor");
          return;
        }

        const nombreAnterior = resultado[0].nombre;

        // Verificar si el nuevo nombre ya está en uso
        connection.query(
          "SELECT COUNT(*) AS count FROM usuarios WHERE nombre = ? AND id != ?",
          [nuevoNombre, usuarioId],
          (err, resultado) => {
            if (err) {
              connection.release(); // Liberar la conexión de vuelta al pool
              console.error("Error al verificar el nombre de usuario:", err);
              res.status(500).send("Error interno del servidor");
              return;
            }

            const count = resultado[0].count;

            if (count > 0) {
              connection.release(); // Liberar la conexión de vuelta al pool

              // Si el nombre ya está en uso, mostrar un mensaje de alerta
              res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
              Swal.fire({
                title: 'Nombre de usuario en uso',
                text: 'El nombre de usuario ya está en uso. Por favor, elige otro nombre.',
                icon: 'error',
                confirmButtonText: 'OK'
              }).then(() => {
                window.location.href = "/editar-usuario/${usuarioId}";
              });
            </script>
          `);
            } else {
              // Actualizar el nombre del usuario en la tabla de usuarios
              connection.query(
                "UPDATE usuarios SET nombre = ?, email = ?, contraseña = ?, rol = ? WHERE id = ?",
                [nuevoNombre, email, contraseña, rol, usuarioId],
                (err, resultado) => {
                  if (err) {
                    connection.release(); // Liberar la conexión de vuelta al pool
                    console.error("Error al actualizar el usuario:", err);
                    res.status(500).send("Error interno del servidor");
                    return;
                  }

                  // Actualizar el nombre en la tabla de vehículos
                  connection.query(
                    "UPDATE catalogos SET usuarioAgrego = ? WHERE usuarioAgrego = ?",
                    [nuevoNombre, nombreAnterior],
                    (err, resultado) => {
                      connection.release(); // Liberar la conexión de vuelta al pool

                      if (err) {
                        console.error(
                          "Error al actualizar el nombre en la tabla de vehículos:",
                          err
                        );
                        res.status(500).send("Error interno del servidor");
                        return;
                      }

                      console.log(
                        "Usuario y vehículos actualizados correctamente"
                      );
                      // Redireccionar a la página de vehículos después de editar el usuario
                      res.redirect("/catalogo");
                    }
                  );
                }
              );
            }
          }
        );
      }
    );
  });
});

// Ruta para confirmar la eliminación de un usuario
app.post("/borrar-usuario/:id", (req, res) => {
  const usuarioId = req.params.id;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión del pool:", err);
      res.status(500).send("Error interno del servidor");
      return;
    }

    // Obtener el nombre del usuario para mostrar en el mensaje de confirmación
    connection.query(
      "SELECT nombre FROM usuarios WHERE id = ?",
      [usuarioId],
      (err, resultado) => {
        connection.release(); // Liberar la conexión de vuelta al pool

        if (err) {
          console.error("Error al buscar el usuario:", err);
          res.status(500).send("Error interno del servidor");
        } else {
          const nombreUsuario = resultado[0].nombre;

          // Mostrar mensaje de confirmación utilizando JavaScript
          res.send(`
          <script>
            var confirmacion = confirm("¿Estás seguro de eliminar a ${nombreUsuario}?");

            if (confirmacion) {
              window.location.href = "/confirmar-eliminacion/${usuarioId}";
            } else {
              window.location.href = "/usuario";
            }
          </script>
        `);
        }
      }
    );
  });
});

// Ruta para confirmar la eliminación de un usuario
app.get("/confirmar-eliminacion/:id", (req, res) => {
  const usuarioId = req.params.id;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión del pool:", err);
      res.status(500).send("Error interno del servidor LINEA 498");
      return;
    }

    // Obtener el nombre del usuario que se está eliminando
    connection.query(
      "SELECT nombre FROM usuarios WHERE id = ?",
      [usuarioId],
      (err, resultado) => {
        if (err) {
          connection.release(); // Liberar la conexión de vuelta al pool
          console.error("Error al obtener el nombre del usuario:", err);
          res.status(500).send("Error interno del servidor");
          return;
        }

        const nombreUsuario = resultado[0].nombre;

        // Eliminar todos los vehículos asociados al usuario
        connection.query(
          "DELETE FROM catalogos WHERE usuarioAgrego = ?",
          [nombreUsuario],
          (err, resultado) => {
            if (err) {
              connection.release(); // Liberar la conexión de vuelta al pool
              console.error(
                "Error al eliminar los vehículos asociados al usuario:",
                err
              );
              res.status(500).send("Error interno del servidor");
              return;
            }

            console.log(
              "Vehículos asociados al usuario eliminados correctamente"
            );

            // Ahora procedemos a eliminar al usuario
            connection.query(
              "DELETE FROM usuarios WHERE id = ?",
              [usuarioId],
              (err, resultado) => {
                connection.release(); // Liberar la conexión de vuelta al pool

                if (err) {
                  console.error("Error al eliminar el usuario:", err);
                  res.status(500).send("Error interno del servidor");
                  return;
                }

                console.log("Usuario eliminado correctamente");
                res.redirect("/catalogo");
              }
            );
          }
        );
      }
    );
  });
});

// Ruta para la página de registro
app.get("/registro", (req, res) => {
  res.render("registro"); // Renderizar la vista de registro
});

// Ruta para la página de politicas de privacidad
app.get("/politicas", (req, res) => {
  res.render("politicas"); // Renderizar la vista de políticas
});

// Ruta para el registro de usuarios
app.post("/registro", async (req, res) => {
  const {
    nombre,
    email,
    contraseña,
    rol,
    passwordAdmin, // Clave del administrador
    passwordSuperAdmin, // Nueva clave para el SuperAdmin
    montoVendedorInput,
    aceptarTerminos,
  } = req.body;

  if (rol === "admin") {
    const contraseñaAdminCorrecta = "z;Jpe[W*3Mqsc-TEAT6C"; // Contraseña del administrador correcta
    if (passwordAdmin !== contraseñaAdminCorrecta) {
      return res.status(400).send(`
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script>
          Swal.fire({
            title: 'Contraseña de administrador incorrecta',
            icon: 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            window.location.href = "/registro"; // Redirige al usuario de nuevo a la página de registro
          });
        </script>
      `);
    }
  } else if (rol === "superadmin") {
    const contraseñaSuperAdminCorrecta = "BSdEGPAjxJwhv3onUX:a"; // Contraseña del SuperAdmin correcta
    if (passwordSuperAdmin !== contraseñaSuperAdminCorrecta) {
      return res.status(400).send(`
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script>
          Swal.fire({
            title: 'Contraseña de SuperAdmin incorrecta',
            icon: 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            window.location.href = "/registro"; // Redirige al usuario de nuevo a la página de registro
          });
        </script>
      `);
    }
  } else if (rol === "vendedor") {
    const costoVendedor = "30000";
    if (!montoVendedorInput || montoVendedorInput < costoVendedor) {
      return res.status(400).send(`
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script>
          Swal.fire({
            title: 'Monto incorrecto',
            text: 'El monto ingresado debe ser mayor a ${costoVendedor}',
            icon: 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            window.location.href = "/registro"; // Redirige al usuario de nuevo a la página de registro
          });
        </script>
      `);
    }
  } else if (!aceptarTerminos) {
    return res.status(400).send(`
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <script>
        Swal.fire({
          title: 'Términos y Condiciones',
          text: 'Debe aceptar los términos y condiciones para registrarse',
          icon: 'error',
          confirmButtonText: 'OK'
        }).then(() => {
          window.location.href = "/registro"; // Redirige al usuario de nuevo a la página de registro
        });
      </script>
    `);
  }

  try {
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    // Obtener una conexión del pool de conexiones
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Error al obtener una conexión del pool:", error);
        return res.status(500).send("Error interno del servidor");
      }

      // Verificar si el correo electrónico o nombre de usuario ya están en uso
      connection.query(
        "SELECT * FROM usuarios WHERE email = ? OR nombre = ?",
        [email, nombre],
        (error, resultados) => {
          if (error) {
            connection.release();
            return res.status(500).send("Error interno del servidor");
          } else if (resultados.length > 0) {
            connection.release();
            return res.status(400).send(`
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
              <script>
                Swal.fire({
                  title: 'Error de Registro',
                  text: 'El correo electrónico o el nombre de usuario ya están en uso',
                  icon: 'error',
                  confirmButtonText: 'OK'
                }).then(() => {
                  window.location.href = "/registro"; // Redirige al usuario de nuevo a la página de registro
                });
              </script>
            `);
          } else {
            // Guardar el nuevo usuario en la base de datos con la contraseña hasheada
            connection.query(
              "INSERT INTO usuarios (nombre, email, contraseña, rol) VALUES (?, ?, ?, ?)",
              [nombre, email, hashedPassword, rol],
              (error, resultado) => {
                connection.release();
                if (error) {
                  return res
                    .status(500)
                    .send("Error interno del servidor al guardar datos");
                }
                res.redirect("/inicio-sesion");
              }
            );
          }
        }
      );
    });
  } catch (error) {
    console.error("Error al hashear la contraseña:", error);
    res.status(500).send("Error interno del servidor al hashear la contraseña");
  }
});

// Ruta para la página de inicio de sesión
app.get("/inicio-sesion", (req, res) => {
  // Verificar si el usuario ha iniciado sesión
  if (req.session.usuario) {
    // Si el usuario ha iniciado sesión, redirigir a catalogo.ejs
    res.redirect("/catalogo");
  } else {
    // Si el usuario no ha iniciado sesión, renderizar la página de inicio de sesión
    res.render("inicio-sesion");
  }
});
// Ruta para el inicio de sesión de usuarios
app.post("/inicio-sesion", (req, res) => {
  const { email, contraseña } = req.body;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((error, connection) => {
    if (error) {
      console.error("Error al obtener una conexión del pool:", error);
      return res.status(500).send("Error interno del servidor");
    }

    // Buscar al usuario en la base de datos por su correo electrónico
    connection.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email],
      async (error, resultados) => {
        if (error) {
          connection.release();
          return res.status(500).send("Error interno del servidor");
        }

        if (resultados.length === 0) {
          connection.release();
          return res.status(401).send(`
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  title: 'Error de Inicio de Sesión',
                  text: 'El correo electrónico o la contraseña son incorrectas, por favor vuelve a intentarlo',
                  icon: 'error',
                  confirmButtonText: 'OK'
                }).then(() => {
                  window.location.href = "/inicio-sesion"; // Redirige al usuario de nuevo a la página de inicio de sesión
                });
              </script>
            </body>
            </html>
          `);
        }

        // Verificar la contraseña utilizando bcrypt
        const contraseñaHash = resultados[0].contraseña;
        const contraseñaValida = await bcrypt.compare(
          contraseña,
          contraseñaHash
        );

        if (!contraseñaValida) {
          connection.release();
          return res.status(401).send(`
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  title: 'Error de Inicio de Sesión',
                  text: 'El correo electrónico o la contraseña son incorrectas, por favor vuelve a intentarlo',
                  icon: 'error',
                  confirmButtonText: 'OK'
                }).then(() => {
                  window.location.href = "/inicio-sesion"; // Redirige al usuario de nuevo a la página de inicio de sesión
                });
              </script>
            </body>
            </html>
          `);
        }

        // Obtener el rol del usuario
        const rol = resultados[0].rol;

        // Iniciar sesión y guardar el nombre de usuario y el rol en la sesión
        req.session.usuario = { nombre: resultados[0].nombre, rol: rol };
        connection.release();
        res.redirect("/catalogo"); // Redirige a la página principal o a donde desees
      }
    );
  });
});

function verificarSesion(req, res, next) {
  const usuarioAutenticado = req.session.usuario; // Por ejemplo, si estás utilizando sesiones

  if (usuarioAutenticado) {
    res.redirect("/catalogo"); // Redirigir al usuario a la página de catálogo si ya ha iniciado sesión
  } else {
    next(); // Permitir que continúe con la solicitud si el usuario no ha iniciado sesión
  }
}

app.post("/inicio-sesion", verificarSesion, (req, res) => {
  // Verificar las credenciales del usuario y obtener el nombre de usuario
  const nombreDeUsuario = obtenerNombreDeUsuarioAlAutenticar(
    req.body.email,
    req.body.contraseña
  ); // Esta función debería verificar las credenciales y devolver el nombre de usuario

  // Guardar el nombre de usuario en la sesión
  req.session.usuario = { nombre: nombreDeUsuario };

  // Redirigir al usuario a la página principal después de iniciar sesión
  res.redirect("/catalogo");
});

app.get("/registrar-cita", (req, res) => {
  res.render("registrar-cita");
});

// Ruta para manejar la solicitud POST desde el formulario
app.post("/registrar-cita", (req, res) => {
  const { nombre, celular, motivo, fecha, hora } = req.body;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((error, connection) => {
    if (error) {
      console.error("Error al obtener una conexión del pool:", error);
      res.status(500).send("Error interno del servidor.");
      return;
    }

    // Query para verificar si la hora está ocupada
    const checkQuery =
      "SELECT COUNT(*) AS count FROM citas WHERE fecha = ? AND hora = ?";
    connection.query(checkQuery, [fecha, hora], (checkError, checkResults) => {
      if (checkError) {
        console.error("Error al verificar la hora:", checkError);
        connection.release();
        res.status(500).send("Error interno del servidor.");
        return;
      }

      if (checkResults[0].count > 0) {
        // Si la hora está ocupada, liberar la conexión y mostrar un alert con SweetAlert
        connection.release();
        return res.send(`
          <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
          <script>
            Swal.fire({
              title: 'Hora Ocupada',
              text: 'Esta hora ya está ocupada.',
              icon: 'error',
              confirmButtonText: 'OK'
            }).then(() => {
              window.location.href = "/registrar-cita";
            });
          </script>
        `);
      }

      // Si la hora no está ocupada, proceder a insertar la cita en la base de datos
      const insertQuery =
        "INSERT INTO citas (nombre, celular, motivo, fecha, hora) VALUES (?, ?, ?, ?, ?)";
      connection.query(
        insertQuery,
        [nombre, celular, motivo, fecha, hora],
        (insertError, insertResults) => {
          if (insertError) {
            console.error("Error al registrar la cita:", insertError);
            connection.release();
            res.status(500).send("Error interno del servidor.");
            return;
          }

          // Si la inserción es exitosa, liberar la conexión, mostrar un alert y redirigir al usuario al índice
          connection.release();
          res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
              Swal.fire({
                title: 'Cita Registrada',
                text: 'La cita se ha registrado exitosamente.',
                icon: 'success',
                confirmButtonText: 'OK'
              }).then(() => {
                window.location.href = "/";
              });
            </script>
          `);
        }
      );
    });
  });
});

// Ruta para agregar un catálogo
app.post("/agregar-catalogo", (req, res) => {
  const {
    marca,
    nombre,
    descripcion,
    terminosGarantia, // Extraer el nuevo campo del request body
    certificacion,
    precioDetal,
    precioMayorista,
    imagen,
  } = req.body;
  const nombreDeUsuario = req.session.usuario.nombre;

  // Obtener una conexión del pool de conexiones
  pool.getConnection((error, connection) => {
    if (error) {
      console.error("Error al obtener una conexión del pool:", error);
      res.status(500).send(`
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        </head>
        <body>
          <script>
            Swal.fire({
              title: 'Error de Conexión',
              text: 'Ha ocurrido un error de conexión, por favor inténtalo de nuevo más tarde',
              icon: 'error',
              confirmButtonText: 'OK'
            }).then(() => {
              window.location.href = "/catalogo"; // Redirige al usuario de nuevo a la página del catálogo
            });
          </script>
        </body>
        </html>
      `);
      return;
    }

    // Query para insertar un nuevo catálogo en la base de datos
    const insertQuery =
      "INSERT INTO catalogos (catalogo, nombre, descripcion, terminos_garantia, certificacion, precio_detal, precio_mayorista, imagen, UsuarioAgrego) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    connection.query(
      insertQuery,
      [
        marca,
        nombre,
        descripcion,
        terminosGarantia, // Añadir el nuevo campo a la query de inserción
        certificacion,
        parseFloat(precioDetal),
        parseFloat(precioMayorista),
        imagen,
        nombreDeUsuario,
      ],
      (err, result) => {
        // Liberar la conexión una vez finalizada la consulta
        connection.release();

        if (err) {
          console.error("Error al agregar catálogo:", err);
          res.status(500).send(`
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  title: 'Error al Agregar Catálogo',
                  text: 'Ha ocurrido un error al agregar el catálogo, por favor inténtalo de nuevo más tarde',
                  icon: 'error',
                  confirmButtonText: 'OK'
                }).then(() => {
                  window.location.href = "/catalogo"; // Redirige al usuario de nuevo a la página del catálogo
                });
              </script>
            </body>
            </html>
          `);
        } else {
          res.status(200).send(`
            <html>
            <head>
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  title: 'Producto Agregado Exitosamente',
                  text: 'El producto ha sido agregado exitosamente',
                  icon: 'success',
                  confirmButtonText: 'OK'
                }).then(() => {
                  window.location.href = "/catalogo"; // Redirige al usuario de nuevo a la página del catálogo
                });
              </script>
            </body>
            </html>
          `);
        }
      }
    );
  });
});

// Ruta para cerrar sesión
app.get("/cerrar-sesion", (req, res) => {
  // Destruir la sesión del usuario
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      res.status(500).send("Error interno del servidor al cerrar sesión");
    } else {
      // Redirigir al usuario a la página de inicio de sesión u otra página
      res.redirect("/");
    }
  });
});

app.get("/inicio-sesion", (req, res) => {
  // Verificar si hay una sesión activa
  if (req.session.usuario) {
    // El usuario ha iniciado sesión
    // Puedes acceder al nombre de usuario usando req.session.usuario.nombre
    res.render("catalogo", { usuario: req.session.usuario.nombre });
  } else {
    // El usuario no ha iniciado sesión
    res.render("/", { usuario: null });
  }
});
// Middleware para verificar el rol del usuario
function verificarRol(rolPermitido) {
  return (req, res, next) => {
    if (
      req.session &&
      req.session.usuario &&
      req.session.usuario.rol === rolPermitido
    ) {
      next(); // El usuario tiene el rol adecuado, continuar con la siguiente ruta
    } else {
      res.status(403).send("Acceso denegado"); // El usuario no tiene permiso para acceder
    }
  };
}

// Ruta para agregar un vehículo
app.post("/agregar-catalogo", (req, res) => {
  // Lógica para agregar un vehículo a la base de datos
  const { marca, nombre, descripcion, certificacion, precio, imagen } =
    req.body;
  const usuarioAgrego = req.session.usuario.nombre; // Obtener el nombre del usuario que inició sesión
  // Agregar el vehículo a la base de datos
  res.redirect("/catalogos"); // Redireccionar a la página de gestión de vehículos
});

app.get("/catalogo", (req, res) => {
  // Obtener el usuario de la sesión
  const usuario = req.session.usuario;

  // Obtener los vehículos del usuario actual
  const catalogosDelUsuario = obtenercatalogos(usuario);

  // Renderizar la vista catalogo.ejs y pasar los vehículos y el usuario
  res.render("catalogo", { catalogos: catalogosDelUsuario, usuario: usuario });
});

app.get("/catalogo", (req, res) => {
  // Obtener datos de vehículos de la base de datos
  pool.query("SELECT * FROM catalogos", (err, results) => {
    if (err) {
      res.status(500).send("Error interno del servidor");
    } else {
      // Renderizar la vista de vehículos y pasar los datos de los vehículos y el usuario
      res.render("catalogo", {
        catalogos: results,
        usuario: req.session.usuario,
      });
    }
  });
});

//Ruta para editar y eliminar catalogos
app.get("/editar-catalogo/:id", (req, res) => {
  const catalogoId = req.params.id;
  // Obtener información del vehículo con el ID proporcionado
  pool.query(
    "SELECT * FROM catalogos WHERE id = ?",
    [catalogoId],
    (err, result) => {
      if (err) {
        console.error("Error al obtener información del vehículo:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Renderizar el formulario de edición de vehículo y pasar los datos del vehículo
        res.render("editar-catalogo", {
          catalogo: result[0],
          usuario: req.session.usuario,
        });
      }
    }
  );
});

// Ruta para procesar la edición de un catálogo
app.post("/editar-catalogo/:id", (req, res) => {
  const catalogoId = req.params.id;
  const {
    marca,
    nombre,
    descripcion,
    terminosGarantia, // Extraer el nuevo campo del request body
    certificacion,
    precioDetal,
    precioMayorista,
    imagen,
  } = req.body;

  // Actualizar la información del catálogo en la base de datos
  pool.query(
    "UPDATE catalogos SET catalogo = ?, nombre = ?, descripcion = ?, terminos_garantia = ?, certificacion = ?, precio_detal = ?, precio_mayorista = ?, imagen = ? WHERE id = ?",
    [
      marca,
      nombre,
      descripcion,
      terminosGarantia, // Añadir el nuevo campo a la query de actualización
      certificacion,
      parseFloat(precioDetal),
      parseFloat(precioMayorista),
      imagen,
      catalogoId,
    ],
    (err, result) => {
      if (err) {
        console.error("Error al editar catálogo:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        res.redirect("/catalogo"); // Redirigir a la página de catálogos después de editar
      }
    }
  );
});

// Ruta para borrar un catálogo
app.post("/borrar-catalogo/:id", (req, res) => {
  const catalogoId = req.params.id;

  // Eliminar el catálogo de la base de datos
  pool.query(
    "DELETE FROM catalogos WHERE id = ?",
    [catalogoId],
    (err, result) => {
      if (err) {
        console.error("Error al borrar producto:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        res.sendStatus(200); // Enviar una respuesta exitosa al cliente
      }
    }
  );
});

// RUTAS PARA LOS catalogos NUEVOS

app.get("/catalogosCompleto", verificarAccesoMayorista, (req, res) => {
  const categorias = [
    "Audifonos",
    "Belleza",
    "BolsasViajeras",
    "Bombillos",
    "CablesCargadores",
    "Calculadoras",
    "Camaras",
    "Campamento",
    "Candados",
    "Cocina",
    "ControlesTV",
    "Deporte",
    "Escolar",
    "Exprimidores",
    "ExtensionesyMultitomas",
    "Ferreteria",
    "Grameras",
    "HervidoresyCafeteras",
    "Humidificadores",
    "Impermeables",
    "InsumosMedicos",
    "Juguetes",
    "Lamparas",
    "LamparasInfantiles",
    "Licuadoras",
    "Linternas",
    "MaquinasYpatilleras",
    "Masajeadores",
    "Mascotas",
    "Memorias",
    "Navidad",
    "OllasArroceras",
    "OllasPresion",
    "Organizadores",
    "Parlantes",
    "Picatodos",
    "Pilas",
    "PistolasdeSilicona",
    "PlanchasdeRopa",
    "Radios",
    "Relojes",
    "Sombrillas",
    "Tecnologia",
    "Telefonos",
    "Termos",
    "Veladoras",
    "Ventiladores",
  ];

  // Obtener el término de búsqueda desde el query string
  const q = req.query.q || ""; // Si no hay término de búsqueda, usar una cadena vacía

  // Función para eliminar diacríticos y caracteres especiales
  const eliminarDiacriticos = (texto) => {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Función para obtener catálogos por categoría y filtro por término de búsqueda
  const obtenerCatalogosPorCategoria = (categoria, callback) => {
    obtenercatalogosPorMarcaYCertificacion(
      categoria,
      "siHay",
      (err, catalogos) => {
        if (err) {
          return callback(err, null);
        }
        // Filtrar los catálogos por el término de búsqueda en el nombre ignorando tildes
        const catalogosFiltrados = catalogos.filter((producto) =>
          eliminarDiacriticos(producto.nombre.toLowerCase()).includes(
            eliminarDiacriticos(q.toLowerCase())
          )
        );

        // Mapear los productos a incluir el precio correspondiente
        const catalogosConPrecios = catalogosFiltrados.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar alfabéticamente por nombre
        catalogosConPrecios.sort((a, b) => a.nombre.localeCompare(b.nombre));

        // Ordenar por precio de menor a mayor
        catalogosConPrecios.sort((a, b) => a.precio - b.precio);

        callback(null, { categoria, catalogos: catalogosConPrecios });
      }
    );
  };

  // Ejecutar las llamadas para todas las categorías en paralelo
  const obtenerTodosLosCatalogos = (categorias, callback) => {
    const resultados = {};
    let pendientes = categorias.length;

    categorias.forEach((categoria) => {
      obtenerCatalogosPorCategoria(categoria, (err, resultado) => {
        if (err) {
          return callback(err);
        }
        resultados[resultado.categoria] = resultado.catalogos;
        pendientes -= 1;
        if (pendientes === 0) {
          callback(null, resultados);
        }
      });
    });
  };

  obtenerTodosLosCatalogos(categorias, (err, catalogosPorCategoria) => {
    if (err) {
      console.error("Error al obtener catálogos:", err);
      res.status(500).send("Error interno del servidor");
    } else {
      res.render("catalogos/catalogosCompleto", {
        catalogosPorCategoria,
        esMayorista: req.esMayorista,
        q: q, // Enviar el término de búsqueda para mostrarlo en el formulario
      });
    }
  });
});

app.use(express.static(path.join(__dirname, "public")));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.post("/upload", upload.array("images"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).contentType("text/html").send(`
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      </head>
      <body>
        <script>
          Swal.fire({
            title: 'Error',
            text: 'No se ha subido ninguna imagen.',
            icon: 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            window.history.back();
          });
        </script>
      </body>
      </html>
    `);
  }

  const imagesDir = path.join(__dirname, "public/imagenes");
  const results = [];
  const existingFiles = [];

  for (const file of req.files) {
    const originalName = path.basename(
      file.originalname,
      path.extname(file.originalname)
    );
    const fileName = originalName + ".webp";
    const filePath = path.join(imagesDir, fileName);

    if (fs.existsSync(filePath)) {
      existingFiles.push(fileName); // Guardar el archivo existente
    } else {
      try {
        // Procesar la imagen usando Jimp
        const image = await Jimp.read(file.buffer); // Leer la imagen desde el buffer
        await image.quality(80).writeAsync(filePath); // Procesar y guardar la imagen

        const metadata = {
          name: fileName,
          size: (file.size / 1024).toFixed(2), // Tamaño en KB
          uploadDate: new Date(),
          format: "webp",
          url: `/imagenes/${fileName}`,
        };

        fs.writeFileSync(
          path.join(imagesDir, originalName + ".json"),
          JSON.stringify(metadata, null, 2)
        );
        results.push({ fileName, status: "uploaded" });
      } catch (error) {
        console.error("Error al procesar la imagen:", error);
        results.push({
          fileName,
          status: "error",
          message: "Error al procesar la imagen.",
        });
      }
    }
  }

  // Si hay archivos existentes, enviamos una respuesta con el estado de los archivos
  if (existingFiles.length > 0) {
    return res.status(409).contentType("text/html").send(`
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      </head>
      <body>
        <script>
          Swal.fire({
            title: 'Advertencia',
            text: 'Algunos archivos ya existen.',
            icon: 'warning',
            confirmButtonText: 'OK'
          }).then(() => {
            window.history.back();
          });
        </script>
      </body>
      </html>
    `);
  }

  res.status(200).contentType("text/html").send(`
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    </head>
    <body>
      <script>
        Swal.fire({
          title: 'Éxito',
          text: 'Imágen subida correctamente.',
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          window.history.back();
        });
      </script>
    </body>
    </html>
  `);
});

app.post("/replace", upload.array("images"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).contentType("text/html").send(`
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      </head>
      <body>
        <script>
          Swal.fire({
            title: 'Error',
            text: 'No se ha subido ninguna imagen.',
            icon: 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            window.history.back();
          });
        </script>
      </body>
      </html>
    `);
  }

  const imagesDir = path.join(__dirname, "public/imagenes");
  const results = [];

  for (const file of req.files) {
    const originalName = path.basename(
      file.originalname,
      path.extname(file.originalname)
    );
    const fileName = originalName + ".webp";
    const filePath = path.join(imagesDir, fileName);

    try {
      // Procesar la imagen usando Jimp
      const image = await Jimp.read(file.buffer); // Leer la imagen desde el buffer
      await image.quality(80).writeAsync(filePath); // Procesar y guardar la imagen

      const metadata = {
        name: fileName,
        size: (file.size / 1024).toFixed(2), // Tamaño en KB
        uploadDate: new Date(),
        format: "webp",
        url: `/imagenes/${fileName}`,
      };

      fs.writeFileSync(
        path.join(imagesDir, originalName + ".json"),
        JSON.stringify(metadata, null, 2)
      );
      results.push({ fileName, status: "replaced" });
    } catch (error) {
      console.error("Error al procesar la imagen:", error);
      results.push({
        fileName,
        status: "error",
        message: "Error al procesar la imagen.",
      });
    }
  }

  res.status(200).contentType("text/html").send(`
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    </head>
    <body>
      <script>
        Swal.fire({
          title: 'Éxito',
          text: 'Imágen reemplazada correctamente.',
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          window.history.back();
        });
      </script>
    </body>
    </html>
  `);
});

// Middleware para parsear datos del formulario
app.use(express.urlencoded({ extended: true }));

// Ruta protegida con autenticación por contraseña
app.get("/admin/imagenes", authenticate, (req, res) => {
  const imagesDir = path.join(__dirname, "public/imagenes");

  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).send("Error al leer la carpeta de imágenes");
    }

    const images = files.filter((file) => /\.(webp)$/.test(file));
    const imageDetails = images.map((image) => {
      const basename = path.basename(image, ".webp");
      const detailsPath = path.join(imagesDir, `${basename}.json`);

      let details = null;
      if (fs.existsSync(detailsPath)) {
        details = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
      }

      return { image, details };
    });

    res.render("imagenes", { images: imageDetails });
  });
});

// Ruta para eliminar una imagen
app.post("/delete-image", (req, res) => {
  const { imageName } = req.body;
  const imagesDir = path.join(__dirname, "public/imagenes");
  const imageFilePath = path.join(imagesDir, imageName);
  const jsonFilePath = path.join(
    imagesDir,
    path.basename(imageName, ".webp") + ".json"
  );

  try {
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
    }

    if (fs.existsSync(jsonFilePath)) {
      fs.unlinkSync(jsonFilePath);
    }

    res.status(200).json({ message: "Imagen eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar la imagen:", error);
    res.status(500).send("Error al eliminar la imagen.");
  }
});

// Ruta para descargar un ZIP con todas las imágenes
app.get("/download-images", (req, res) => {
  const imagesDir = path.join(__dirname, "public/imagenes");
  const zipName = "ImagenesCatalogoVaristi.zip";

  // Crear un archivo ZIP en memoria
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Comprimir con nivel máximo
  });

  // Establecer los encabezados para la descarga del ZIP
  res.setHeader("Content-disposition", `attachment; filename=${zipName}`);
  res.setHeader("Content-type", "application/zip");

  // Crear el archivo ZIP y enviarlo en la respuesta
  archive.pipe(res);

  // Agregar todos los archivos en el directorio de imágenes al ZIP
  archive.directory(imagesDir, false, { date: new Date() });

  // Finalizar el archivo ZIP
  archive.finalize();
});

// Ruta para 'belleza' en Express
app.get("/belleza", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "belleza",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de belleza:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabético) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/belleza", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'relojes' en Express
app.get("/relojes", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Relojes",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de relojes:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/relojes", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'tecnologia' en Express
app.get("/tecnologia", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Tecnologia",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de tecnologia:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/tecnologia", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'telefono' en Express
app.get("/telefono", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Telefono",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de telefono:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/telefono", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'pilas' en Express
app.get("/pilas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion("Pilas", "siHay", (err, catalogos) => {
    if (err) {
      console.error("Error al obtener catálogos de pilas:", err);
      res.status(500).send("Error interno del servidor");
    } else {
      // Ajustar los precios según si es mayorista o no
      catalogos = catalogos.map((producto) => ({
        ...producto,
        precio: req.esMayorista
          ? producto.precio_mayorista
          : producto.precio_detal,
      }));

      // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
      catalogos.sort((a, b) => {
        // Ordenar por nombre (alfabéticamente)
        if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
        if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

        // Si los nombres son iguales, ordenar por precio (menor a mayor)
        return a.precio - b.precio;
      });

      // Renderizar la vista con los catálogos ordenados
      res.render("catalogos/pilas", {
        catalogos,
        esMayorista: req.esMayorista,
      });
    }
  });
});

// Ruta para 'masajeadores' en Express
app.get("/masajeadores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Masajeadores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de masajeadores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/masajeadores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'maquinasypatilleras' en Express
app.get("/maquinasypatilleras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "MaquinasYpatilleras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error(
          "Error al obtener catálogos de máquinas y patilleras:",
          err
        );
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/maquinasypatilleras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'juguetes' en Express
app.get("/juguetes", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Juguetes",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de juguetes:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/juguetes", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'picatodos' en Express
app.get("/picatodos", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Picatodos",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de picatodos:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/picatodos", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'exprimidores' en Express
app.get("/exprimidores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Exprimidores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de exprimidores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/exprimidores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'termos' en Express
app.get("/termos", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Termos",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de termos:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/termos", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'hervidores y cafeteras' en Express
app.get("/hervidoresycafeteras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "HervidoresyCafeteras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error(
          "Error al obtener catálogos de hervidores y cafeteras:",
          err
        );
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/hervidoresycafeteras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'impermeables' en Express
app.get("/impermeables", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Impermeables",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de impermeables:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/impermeables", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'ollas arroceras' en Express
app.get("/ollasArroceras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "OllasArroceras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de ollas arroceras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/ollasArroceras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'ollas presión' en Express
app.get("/ollasPresion", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "OllasPresion",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de ollas presión:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/ollasPresion", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'organizadores' en Express
app.get("/organizadores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Organizadores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de organizadores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/organizadores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'cablesCargadores' en Express
app.get("/cablesCargadores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "CablesCargadores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de cables-cargadores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/cablesCargadores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'bombillos' en Express
app.get("/bombillos", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Bombillos",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de bombillos:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/bombillos", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'lamparas' en Express
app.get("/lamparas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Lamparas",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de lámparas:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/lamparas", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'lamparasInfantiles' en Express
app.get("/lamparasInfantiles", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "LamparasInfantiles",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error(
          "Error al obtener catálogos de lámparas infantiles:",
          err
        );
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/lamparasInfantiles", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'controlesTV' en Express
app.get("/controlesTV", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "ControlesTV",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de controles TV:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/controlesTV", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'sombrillas' en Express
app.get("/sombrillas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Sombrillas",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de sombrillas:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/sombrillas", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'BolsasViajeras' en Express
app.get("/bolsasViajeras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "BolsasViajeras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de bolsas viajeras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/bolsasViajeras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Ventiladores' en Express
app.get("/ventiladores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Ventiladores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de ventiladores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/ventiladores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'licuadoras' en Express
app.get("/licuadoras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Licuadoras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de licuadoras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/licuadoras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'candados' en Express
app.get("/candados", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Candados",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de candados:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/candados", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'insumosMedicos' en Express
app.get("/insumosMedicos", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "InsumosMedicos",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de insumos médicos:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/insumosMedicos", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'linternas' en Express
app.get("/linternas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Linternas",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de linternas:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/linternas", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'planchas de ropa' en Express
app.get("/planchasdeRopa", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "PlanchasdeRopa",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de planchas de ropa:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/planchasdeRopa", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'humidificadores' en Express
app.get("/humidificadores", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Humidificadores",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de humidificadores:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/humidificadores", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'mascotas' en Express
app.get("/mascotas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Mascotas",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de mascotas:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/mascotas", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Audifonos' en Express
app.get("/audifonos", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Audifonos",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de Audífonos:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/audifonos", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Memorias' en Express
app.get("/memorias", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Memorias",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de memorias:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/memorias", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Camaras' en Express
app.get("/camaras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Camaras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de cámaras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/camaras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Campamento' en Express
app.get("/campamento", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Campamento",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de Campamento:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/campamento", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Radios' en Express
app.get("/radios", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Radios",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de radios:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/radios", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Parlantes' en Express
app.get("/parlantes", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Parlantes",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de parlantes:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/parlantes", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Cocina' en Express
app.get("/cocina", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Cocina",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de cocina:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/cocina", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Grameras' en Express
app.get("/grameras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Grameras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de grameras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/grameras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Veladoras' en Express
app.get("/veladoras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Veladoras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de veladoras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/veladoras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Escolar' en Express
app.get("/escolar", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Escolar",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de Escolar:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/escolar", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Calculadoras' en Express
app.get("/calculadoras", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Calculadoras",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de calculadoras:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/calculadoras", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Extensiones y Multitomas' en Express
app.get("/extensionesyMultitomas", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "ExtensionesyMultitomas",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error(
          "Error al obtener catálogos de extensiones y multitomas:",
          err
        );
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/extensionesyMultitomas", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Ferretería' en Express
app.get("/ferreteria", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Ferreteria",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de ferretería:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/ferreteria", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Deporte' en Express
app.get("/deporte", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Deporte",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de DEPORTE:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/deporte", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Navidad' en Express
app.get("/navidad", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "Navidad",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error("Error al obtener catálogos de NAVIDAD:", err);
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/navidad", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Ruta para 'Pistolas de Silicona' en Express
app.get("/pistolasdeSilicona", verificarAccesoMayorista, (req, res) => {
  obtenercatalogosPorMarcaYCertificacion(
    "PistolasdeSilicona",
    "siHay",
    (err, catalogos) => {
      if (err) {
        console.error(
          "Error al obtener catálogos de pistolas de silicona:",
          err
        );
        res.status(500).send("Error interno del servidor");
      } else {
        // Ajustar los precios según si es mayorista o no
        catalogos = catalogos.map((producto) => ({
          ...producto,
          precio: req.esMayorista
            ? producto.precio_mayorista
            : producto.precio_detal,
        }));

        // Ordenar primero por nombre (alfabéticamente) y luego por precio (menor a mayor)
        catalogos.sort((a, b) => {
          // Ordenar por nombre (alfabéticamente)
          if (a.nombre.toLowerCase() < b.nombre.toLowerCase()) return -1;
          if (a.nombre.toLowerCase() > b.nombre.toLowerCase()) return 1;

          // Si los nombres son iguales, ordenar por precio (menor a mayor)
          return a.precio - b.precio;
        });

        // Renderizar la vista con los catálogos ordenados
        res.render("catalogos/pistolasdeSilicona", {
          catalogos,
          esMayorista: req.esMayorista,
        });
      }
    }
  );
});

// Escuchar en el puerto
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});

function obtenercatalogosPorMarcaYCertificacion(
  marca,
  certificacion,
  callback
) {
  // Consulta SQL para obtener los vehículos según la marca y la certificación
  const sql = `SELECT * FROM catalogos WHERE catalogo = ? AND certificacion = ?`;

  // Ejecutar la consulta SQL utilizando el pool de conexiones
  pool.query(sql, [marca, certificacion], (err, results) => {
    if (err) {
      console.error("Error al obtener vehículos:", err);
      return callback(err, null);
    }

    // Devolver los resultados de la consulta
    callback(null, results);
  });
}

function obtenercatalogos(usuario, callback) {
  // Consulta SQL para obtener los vehículos del usuario actual
  const sql = `SELECT * FROM catalogos WHERE usuarioAgrego = ?`;

  // Ejecutar la consulta SQL
  pool.query(sql, [usuario.nombre], (err, results) => {
    if (err) {
      console.error("Error al obtener vehículos:", err);
      return callback(err, null);
    }

    // Devolver los resultados de la consulta
    callback(null, results);
  });

  const catalogosDelUsuario = catalogos.filter(
    (catalogo) => catalogo.UsuarioAgrego === usuario.nombre
  );

  return catalogosDelUsuario;
}

// Estructura del carrito de compras
let carrito = {};

// Middleware para agregar productos al carrito
app.post("/agregar-al-carrito", (req, res) => {
  const { productoId, cantidad } = req.body;

  // Verifica si el producto ya está en el carrito
  if (carrito[productoId]) {
    carrito[productoId] += parseInt(cantidad);
  } else {
    carrito[productoId] = parseInt(cantidad);
  }

  // Envía una respuesta indicando que el producto se agregó al carrito
  res.json({ mensaje: "Producto agregado al carrito" });
});

app.get("/download-backup", (req, res) => {
  const today = new Date();
  const dateStr = `${today.getDate()}${(today.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${today.getFullYear()}`;

  const mainZipName = `VA${dateStr}.zip`;
  const imagesDir = path.join(__dirname, "public/imagenes");
  const imagesZipName = `IMAGENES.zip`;
  const dbZipName = `DATABASE.zip`;
  const dbFileName = `varisti${dateStr}.sql`;

  const connection = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 10, // Número máximo de conexiones en el pool
    waitForConnections: true, // Permitir que las solicitudes esperen si no hay conexiones disponibles en el pool
    queueLimit: 0, // Sin límite en la cantidad de conexiones en la cola de espera
  });

  connection.connect((err) => {
    if (err) {
      console.error("Error al conectar a la base de datos:", err);
      return res.status(500).send("Error al conectar a la base de datos.");
    }

    // 1. Crear respaldo de la base de datos manualmente
    connection.query("SHOW TABLES", (err, tables) => {
      if (err) {
        console.error("Error al obtener tablas:", err);
        return res.status(500).send("Error al obtener tablas.");
      }

      const stream = fs.createWriteStream(path.join(__dirname, dbFileName));

      // Iterar sobre las tablas
      tables.forEach((row, index) => {
        const tableName = Object.values(row)[0];

        // Obtener la estructura de cada tabla
        connection.query(
          `SHOW CREATE TABLE ${tableName}`,
          (err, createTableQuery) => {
            if (err) {
              console.error(
                `Error al obtener estructura de la tabla ${tableName}:`,
                err
              );
              return;
            }

            stream.write(`${createTableQuery[0]["Create Table"]};\n\n`);

            // Obtener los datos de la tabla
            connection.query(`SELECT * FROM ${tableName}`, (err, rows) => {
              if (err) {
                console.error(
                  `Error al obtener datos de la tabla ${tableName}:`,
                  err
                );
                return;
              }

              rows.forEach((data) => {
                const values = Object.values(data)
                  .map((value) =>
                    typeof value === "string" ? `'${value}'` : value
                  )
                  .join(",");
                stream.write(`INSERT INTO ${tableName} VALUES (${values});\n`);
              });

              // Verificar si es la última tabla para cerrar el stream
              if (index === tables.length - 1) {
                stream.end(() => {
                  console.log("Respaldo de la base de datos completo.");

                  // Continuar con el proceso de compresión en ZIP

                  // 2. Crear un archivo ZIP para las imágenes
                  const imagesZip = archiver("zip", {
                    zlib: { level: 9 },
                  });
                  const imagesZipPath = path.join(__dirname, imagesZipName);

                  const imagesOutput = fs.createWriteStream(imagesZipPath);
                  imagesZip.pipe(imagesOutput);

                  imagesZip.directory(imagesDir, false, { date: new Date() });
                  imagesZip.finalize();

                  imagesOutput.on("close", () => {
                    console.log("Imágenes comprimidas.");

                    // 3. Crear un archivo ZIP para la base de datos
                    const dbZip = archiver("zip", {
                      zlib: { level: 9 },
                    });
                    const dbZipPath = path.join(__dirname, dbZipName);

                    const dbOutput = fs.createWriteStream(dbZipPath);
                    dbZip.pipe(dbOutput);

                    dbZip.file(path.join(__dirname, dbFileName), {
                      name: dbFileName,
                    });

                    dbZip.finalize();

                    dbOutput.on("close", () => {
                      console.log("Base de datos comprimida.");

                      // 4. Crear el archivo ZIP principal y agregar los sub-archivos ZIP
                      const archive = archiver("zip", {
                        zlib: { level: 9 },
                      });

                      res.setHeader(
                        "Content-disposition",
                        `attachment; filename=${mainZipName}`
                      );
                      res.setHeader("Content-type", "application/zip");

                      archive.pipe(res);

                      archive.file(imagesZipPath, { name: imagesZipName });
                      archive.file(dbZipPath, { name: dbZipName });

                      archive.finalize();

                      // Eliminar archivos temporales después de la creación del ZIP principal
                      archive.on("end", () => {
                        fs.unlinkSync(imagesZipPath); // Eliminar archivo temporal de imágenes
                        fs.unlinkSync(dbZipPath); // Eliminar archivo temporal de base de datos
                        fs.unlinkSync(path.join(__dirname, dbFileName)); // Eliminar archivo SQL
                      });
                    });
                  });
                });
              }
            });
          }
        );
      });
    });
  });
});
