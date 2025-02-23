const password = 'admin-javier'; // Cambia esto por la contraseña que desees

function authenticate(req, res, next) {
  // Verifica si la contraseña ha sido proporcionada en el query string
  if (req.query.password === password) {
    return next(); // Contraseña correcta, sigue con la siguiente función de middleware o ruta
  }

  // Si no, responde con un mensaje de error
  res.status(401).send(`
    <html>
    <head>
      <title>Acceso Denegado</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          background-color: #f0f4f8;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          text-align: center;
          background: #fff;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          width: 300px;
        }
        h1 {
          color: #e74c3c;
        }
        p {
          color: #555;
        }
        form {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        label {
          margin-bottom: 10px;
          font-weight: bold;
          color: #333;
        }
        input[type="password"] {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin-bottom: 20px;
          width: 100%;
          box-sizing: border-box;
        }
        button {
          background-color: #3498db;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover {
          background-color: #2980b9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Acceso Denegado</h1>
        <p>Por favor, proporciona la contraseña correcta.</p>
        <form action="/admin/imagenes" method="get">
          <label for="password">Contraseña:</label>
          <input type="password" id="password" name="password" required>
          <button type="submit">Acceder</button>
        </form>
      </div>
    </body>
    </html>
  `);
}

module.exports = authenticate;
