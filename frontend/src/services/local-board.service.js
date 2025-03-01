import { storageService } from './async-storage.service.js'
import { userService } from './user.service.js'
import { utilService } from './util.service.js'

const STORAGE_KEY = 'boardDB'

_createBoards()

export const boardService = {
    query,
    getById,
    save,
    remove,
    getEmptyBoard,
    getDefaultFilter,
    getDefaultFilterBoard,
    getFilterFromSearchParams,
    getEmptyGroup,
    getEmptyTask,
    getEmptyComment,
    getEmptyActivity
}

async function query(filterBy = getDefaultFilterBoard()) {
    let boards = await storageService.query(STORAGE_KEY)
    if (filterBy.title) {
        const regex = new RegExp(filterBy.title, 'i')
        boards = boards.filter(board => regex.test(board.title))
    }
    if (filterBy.isStarred) boards = boards.filter(board => board.isStarred === true)
    return boards
}

async function getById(boardId, filterBy = getDefaultFilter()) {
    try {
        let board = await storageService.get(STORAGE_KEY, boardId)
        if (filterBy.title) {
            const regex = new RegExp(filterBy.title, 'i')
            const groups = board.groups.filter(group => regex.test(group.title))
            groups.forEach(group => {
                group.tasks = group.tasks.filter(task => regex.test(task.title))
            })
            board.groups = groups
        }
        return board
    } catch (err) {
        throw err
    }
}

function remove(boardId) {
    return storageService.remove(STORAGE_KEY, boardId)
}

function save(board) {
    if (board._id) return storageService.put(STORAGE_KEY, board)
    return storageService.post(STORAGE_KEY, board)
}

function getDefaultFilter() {
    return {
        title: '',
        isStarred: null
    }
}

function getDefaultFilterBoard() {
    return { title: '' }
}

function getFilterFromSearchParams(searchParams) {
    const emptyFilter = getDefaultFilter()
    const filterBy = {}
    for (const field in emptyFilter) {
        filterBy[field] = searchParams.get(field) || ''
    }
    return filterBy
}

function getEmptyGroup() {
    return {
        "title": 'New Group',
        "archivedAt": Date.now(),
        "tasks": [],
        "color": '#ffcb00',
        "id": utilService.makeId()
    }
}

function getEmptyTask() {
    return {
        "title": "",
        "status": "",
        "priority": "",
        "memberIds": [],
        "dueDate": '',
        "comments": []
    }
}

function getEmptyComment() {
    return {
        "archivedAt": Date.now(),
        "byMember": {
            "_id": "m101",
            "fullname": "SeedChris",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
        }, "txt": "",
        "style": {
            "textDecoration": "none",
            "fontWeight": "normal",
            "fontStyle": "normal",
            "textAlign": "Left"
        }
    }
}

function getEmptyActivity() {
    return {
        "action": "status",
        "createdAt": Date.now(),
        "byMember": userService.getLoggedinUser() || {
            "_id": "u101",
            "fullname": "SeedChris",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
        },
        "task": {
            "id": "c101",
            "title": "Replace Logo"
        },
        "from": {}, 
        "to": {}
    }
}

function getEmptyBoard() {
    return {
        "title": 'New Board',
        "archivedAt": Date.now(),
        "isStarred": false,
        "labels": [
            {
                "id": "l101",
                "title": "Done",
                "color": "#037f4c"
            },
            {
                "id": "l102",
                "title": "Progress",
                "color": "#ffcb00"
            },
            {
                "id": "l103",
                "title": "stack",
                "color": "#e2445c"
            }
        ],
        "members": [
            {
                "_id": "m101",
                "fullname": "SeedChris",
                "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
            },],
        "groups": [],
        "activities": [],
        "cmpsOrder": ["status-picker", "member-picker", "date-picker", 'priority-picker']
    }
}

function _createBoards() {
    let boards = utilService.loadFromStorage(STORAGE_KEY)
    if (!boards) {
        boards = []
        boards.push(
            {
                "_id": "b101",
                "title": "Seed Proj",
                "archivedAt": 1589983468418,
                "isStarred": false,
                "createdBy": {
                    "_id": "m102",
                    "fullname": "SeedChris",
                    "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
                },
                "labels": [
                    {
                        "id": "l101",
                        "title": "Done",
                        "color": "#00c875"
                    },
                    {
                        "id": "l102",
                        "title": "Progress",
                        "color": "#fdab3d"
                    },
                    {
                        "id": "l103",
                        "title": "Stuck",
                        "color": "#e2445c"
                    },
                    {
                        "id": "l104",
                        "title": "Low",
                        "color": "#ffcb00"
                    },
                    {
                        "id": "l105",
                        "title": "Medium",
                        "color": "#a25ddc"
                    },
                    {
                        "id": "l106",
                        "title": "High",
                        "color": "#e2445c"
                    },
                    {
                        "id": "l107",
                        "title": "",
                        "color": "#c4c4c4"
                    },
                ],
                "members": [
                    {
                        "id": "m101",
                        "fullname": "SeedChris",
                        "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
                    },
                ],
                "groups": [{
                    "id": "g101",
                    "title": "Group 1",
                    "archivedAt": 1589983468418,
                    "tasks": [
                        {
                            "id": "c101",
                            "title": "Replace logo",
                            "status": "Stuck",
                            "priority": "Medium",
                            "memberIds": ["m101", "m102", "m103"],
                            "dueDate": 1615621,
                            "comments": [
                                {
                                    "id": "a101",
                                    "archivedAt": 1589983468418,
                                    "byMember": {
                                        "_id": "m101",
                                        "fullname": "SeedChris",
                                        "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
                                    }, 
                                    "txt": "seedtext",
                                    "style": {
                                        "textDecoration": "none",
                                        "fontWeight": "normal",
                                        "fontStyle": "normal",
                                        "textAlign": "Left"
                                    }
                                },
                            ]
                        },
                        {
                            "id": "c102",
                            "title": "Add Samples",
                            "status": "Done",
                            "priority": "Low",
                            "memberIds": ["m101"],
                            "dueDate": 16156211111,
                            "comments": []
                        },
                    ],
                    "color": '#66ccff'
                },
                {
                    "id": "g102",
                    "title": "Group 2",
                    "tasks": [
                        {
                            "id": "c103",
                            "title": "Help me",
                            "status": "Done",
                            "priority": "High",
                            "memberIds": ["m101", "m102", "m103"],
                            "dueDate": 16156215211,
                            "comments": []
                        },
                        {
                            "id": "c104",
                            "title": "Help me",
                            "status": "Done",
                            "priority": "High",
                            "memberIds": ["m103"],
                            "dueDate": 16156215211,
                            "comments": []
                        },
                        {
                            "id": "c105",
                            "title": "Help me",
                            "status": "Progress",
                            "priority": "Low",
                            "memberIds": ["m101", "m103"],
                            "dueDate": 16156215211,
                            "comments": []
                        }
                    ],
                    "color": '#a25ddc'
                }],
                "activities": [],
                "cmpsOrder": ["member-picker", "status-picker", "date-picker", 'priority-picker']
            }
        )
        utilService.saveToStorage(STORAGE_KEY, boards)
    }
}