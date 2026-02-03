const express = require('express')
const {login, signup, logout, googleLogin} = require('./auth.controller')

const router = express.Router()

router.post('/login', login)
router.post('/signup', signup)
router.post('/google', googleLogin)
router.post('/logout', logout)

module.exports = router