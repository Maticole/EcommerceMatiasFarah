const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../dao/models/userModel');
const nodemailer = require('nodemailer');


const sendInactiveUserEmail = async (email) => {
  const transporter = nodemailer.createTransport({
    
    service: 'Gmail', 
    auth: {
      user: 'tu_correo@gmail.com',
      pass: 'tu_contraseña', 
    },
  });

  const mailOptions = {
    from: 'your@example.com',
    to: email,
    subject: 'Eliminación de cuenta por inactividad',
    text: 'Tu cuenta ha sido eliminada debido a la inactividad. Por favor, contáctanos si deseas recuperarla.'
  };

  await transporter.sendMail(mailOptions);
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role');
    res.status(200).json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


exports.deleteInactiveUsers = async (req, res) => {
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const inactiveUsers = await User.deleteMany({ last_connection: { $lt: twoDaysAgo } });

    
    inactiveUsers.forEach(user => {
      sendInactiveUserEmail(user.email);
    });

    res.status(200).json({ status: 'success', message: 'Usuarios inactivos eliminados' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user', 
    });

    await newUser.save();
    res.status(201).json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { uid } = req.params;
    const { newRole } = req.body;

    if (!['user', 'premium', 'admin'].includes(newRole)) {
      return res.status(400).json({ message: 'Rol no válido' });
    }

    const user = await User.findById(uid);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.role = newRole;
    await user.save();

    return res.status(200).json({ message: 'Rol de usuario actualizado exitosamente', data: user });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
};


const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email: payload.email });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({ message: 'La nueva contraseña no puede ser igual a la actual' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: 'Contraseña restablecida con éxito' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};


const uploadDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se han subido documentos' });
    }

    const documents = req.files.map(file => ({
      name: file.originalname,
      reference: file.path
    }));

    user.documents = documents;
    await user.save();

    return res.status(200).json({ message: 'Documentos subidos exitosamente' });
  } catch (error) {
    console.error('Error al subir documentos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  resetPassword,
  uploadDocuments,
  getAllUsers,
  deleteInactiveUsers,
  registerUser,
  changeUserRole,
};