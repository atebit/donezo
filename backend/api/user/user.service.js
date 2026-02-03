const dbService = require('../../services/db.service')
const logger = require('../../services/logger.service')
const ObjectId = require('mongodb').ObjectId

module.exports = {
    query,
    getById,
    getByUsername,
    upsertGoogleUser,
    remove,
    update,
    add
}

async function query(filterBy = {}) {
    const criteria = _buildCriteria(filterBy)
    try {
        const collection = await dbService.getCollection('user')
        var users = await collection.find(criteria).toArray()
        users = users.map(user => {
            delete user.password
            user.createdAt = ObjectId(user._id).getTimestamp()
            return user
        })
        return users
    } catch (err) {
        logger.error('cannot find users', err)
        throw err
    }
}


async function getById(userId) {
    try {
        const collection = await dbService.getCollection('user')
        const user = await collection.findOne({ _id: ObjectId(userId) })
        delete user.password
        return user
    } catch (err) {
        logger.error(`while finding user by id: ${userId}`, err)
        throw err
    }
}
async function getByUsername(username) {
    try {
        const collection = await dbService.getCollection('user')
        const user = await collection.findOne({ username })
        return user
    } catch (err) {
        logger.error(`while finding user by username: ${username}`, err)
        throw err
    }
}

async function remove(userId) {
    try {
        const collection = await dbService.getCollection('user')
        await collection.deleteOne({ _id: ObjectId(userId) })
    } catch (err) {
        logger.error(`cannot remove user ${userId}`, err)
        throw err
    }
}

async function update(user) {
    try {
        const userToSave = {
            _id: ObjectId(user._id), 
            fullname: user.fullname,
            username: user.username,
            password: user.password,
            imgUrl: user.imgUrl,
        }
        const collection = await dbService.getCollection('user')
        await collection.updateOne({ _id: userToSave._id }, { $set: userToSave })
        delete userToSave.password
        return userToSave
    } catch (err) {
        logger.error(`cannot update user ${user._id}`, err)
        throw err
    }
}

async function add(user) {
    try {
        const userToAdd = {
            username: user.username,
            password: user.password,
            fullname: user.fullname,
            imgUrl: user.imgUrl,
        }
        const collection = await dbService.getCollection('user')
        await collection.insertOne(userToAdd)
        return userToAdd
    } catch (err) {
        logger.error('cannot add user', err)
        throw err
    }
}

async function upsertGoogleUser({ googleId, email, fullname, imgUrl }) {
    try {
        if (!googleId) throw new Error('Missing googleId')
        if (!email) throw new Error('Missing email')

        const collection = await dbService.getCollection('user')

        const existingUser = await collection.findOne({ $or: [{ googleId }, { username: email }, { email }] })

        if (existingUser) {
            await collection.updateOne(
                { _id: existingUser._id },
                {
                    $set: {
                        googleId,
                        email,
                        username: existingUser.username || email,
                        fullname: fullname || existingUser.fullname,
                        imgUrl: imgUrl || existingUser.imgUrl,
                    },
                }
            )

            const updated = await collection.findOne({ _id: existingUser._id })
            delete updated.password
            updated._id = updated._id.toString()
            return updated
        }

        const userToAdd = {
            googleId,
            email,
            username: email,
            fullname,
            imgUrl,
            password: null,
        }

        const insertRes = await collection.insertOne(userToAdd)
        const inserted = await collection.findOne({ _id: insertRes.insertedId })
        delete inserted.password
        inserted._id = inserted._id.toString()
        return inserted
    } catch (err) {
        logger.error('cannot upsert google user', err)
        throw err
    }
}

function _buildCriteria(filterBy) {
    const criteria = {}
    if (filterBy.txt) {
        const txtCriteria = { $regex: filterBy.txt, $options: 'i' }
        criteria.$or = [
            {
                username: txtCriteria
            },
            {
                fullname: txtCriteria
            }
        ]
    }
    if (filterBy.minBalance) {
        criteria.score = { $gte: filterBy.minBalance }
    }
    return criteria
}




