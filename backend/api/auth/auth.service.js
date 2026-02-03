const Cryptr = require('cryptr')
const bcrypt = require('bcrypt')
const { OAuth2Client } = require('google-auth-library')
const userService = require('../user/user.service')
const logger = require('../../services/logger.service')
const cryptr = new Cryptr(process.env.SECRET1 || 'Secret-Puk-1234')

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

module.exports = {
    signup,
    login,
    googleLogin,
    getLoginToken,
    validateToken
}

async function login(username, password) {
    logger.debug(`auth.service - login with username: ${username}`)
    const user = await userService.getByUsername(username)
    if (!user) return Promise.reject('Invalid username or password')
    delete user.password
    user._id = user._id.toString()
    return user
}
   

async function signup({username, password, fullname, imgUrl}) {
    const saltRounds = 10

    logger.debug(`auth.service - signup with username: ${username}, fullname: ${fullname}`)
    if (!username || !password || !fullname) return Promise.reject('Missing required signup information')

    const userExist = await userService.getByUsername(username)
    if (userExist) return Promise.reject('Username already taken')

    const hash = await bcrypt.hash(password, saltRounds)
    return userService.add({ username, password: hash, fullname, imgUrl })
}

async function googleLogin(credential) {
    try {
        if (!credential) return Promise.reject('Missing google credential')
        if (!process.env.GOOGLE_CLIENT_ID) return Promise.reject('Missing GOOGLE_CLIENT_ID')

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        })
        const payload = ticket.getPayload()

        const googleId = payload.sub
        const email = payload.email
        const fullname = payload.name || email
        const imgUrl = payload.picture

        const user = await userService.upsertGoogleUser({ googleId, email, fullname, imgUrl })
        return user
    } catch (err) {
        logger.error('auth.service - googleLogin failed', err)
        throw err
    }
}


function getLoginToken(user) {
    const userInfo = {_id : user._id, fullname: user.fullname, isAdmin: user.isAdmin}
    return cryptr.encrypt(JSON.stringify(userInfo))    
}

function validateToken(loginToken) {
    try {
        const json = cryptr.decrypt(loginToken)
        const loggedinUser = JSON.parse(json)
        return loggedinUser

    } catch(err) {
        console.log('Invalid login token')
    }
    return null
}