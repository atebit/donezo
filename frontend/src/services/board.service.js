import { httpService } from './http.service.js'
import { userService } from './user.service.js'
import { utilService } from './util.service.js'

const BASE_URL = 'board/'

export const boardService = {
    query,
    getById,
    getFilteredBoard,
    save,
    remove,
    getDefaultFilterBoard,
    getDefaultFilterBoards,
    getFilterFromSearchParams,
    getEmptyGroup,
    getEmptyTask,
    getEmptyComment,
    getEmptyActivity,
    getEmptyBoard,
    updateTask,
    updateGroup,
    updateBoardLabels
}

function query(filter = getDefaultFilterBoards()) {
    const queryParams = `?title=${filter.title}&isStarred=${filter.isStarred}`
    return httpService.get(BASE_URL + queryParams)
}

function getFilteredBoard(board, filterBy = getDefaultFilterBoard()) {
    const filteredBoard = {...board}
    if (filterBy.title) {
        const regex = new RegExp(filterBy.title, 'i')
        const groups = filteredBoard.groups.filter(group => regex.test(group.title))
        groups.forEach(group => {
            group.tasks = group.tasks.filter(task => regex.test(task.title))
        })
    }
    if (filterBy.memberId) {
        const groups = filteredBoard.groups
        groups.forEach(group => {
            group.tasks = group.tasks.filter(task => task.memberIds.includes(filterBy.memberId))
        })
    }
    return filteredBoard
}

function getById(boardId) {
    return httpService.get(BASE_URL + boardId)
}

function remove(boardId) {
    return httpService.delete(BASE_URL + boardId)
}

function save(board) {
    if (board._id) return httpService.put(BASE_URL + board._id, board)
    return httpService.post(BASE_URL, board)
}

function updateTask(boardId, groupId, task) {
    return httpService.put(`${BASE_URL}${boardId}/${groupId}/${task.id}`, task)
}

function updateGroup(boardId, group) {
    return httpService.put(`${BASE_URL}${boardId}/${group.id}`, group)
}

function updateBoardLabels(boardId, newLabels) {
  // Assuming your API supports partial updates of the board document,
  // you can send an object containing just the labels field.
  return httpService.put(`${BASE_URL}${boardId}`, { labels: newLabels })
}

function getDefaultFilterBoards() {
    return {
        title: '',
        isStarred: false
    }
}

function getDefaultFilterBoard() {
    return {
            title: '',
            memberId: '' 
        }
}

function getFilterFromSearchParams(searchParams) {
    const emptyFilter = getDefaultFilterBoard()
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
    }
}

function getEmptyTask() {
    return {
        "title": "",
        "status": "",
        "priority": "",
        "memberIds": [],
        "dueDate": '',
        "number": null,
        "checkbox": false,
        "text": "",
        "link": "",
        "comments": [],
        "updatedBy": {
            "imgUrl": "",
            "date": null
        },
        "file": "",
    }
}

function getEmptyComment() {
    return {
        "archivedAt": Date.now(),
        "byMember": {
            "_id": null,
            "fullname": "SeedGuest",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757897/guest_f8d60j_psycw9.png"
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
            "_id": null,
            "fullname": "SeedGuest",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757897/guest_f8d60j_psycw9.png"
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
        "createdBy": {
            "fullname": "SeedChris",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg",
            "_id": utilService.makeId()
        },
        "statusLabels": [
            { id: "s101", title: "Done", color: "#00C875" },
            { id: "s102", title: "Working on it", color: "#FDAB3D" },
            { id: "s103", title: "Stuck", color: "#E2445C" },
            { id: "s104", title: "Waiting for review", color: "#A25DDC" },
            { id: "s105", title: "Pending", color: "#579BFC" },
            { id: "s106", title: "", color: "#C4C4C4" },
        ],
        "priorityLabels": [
            { id: "p101", title: "Critical", color: "#333333" },
            { id: "p102", title: "High", color: "#E2445C" },
            { id: "p103", title: "Medium", color: "#FDAB3D" },
            { id: "p104", title: "Low", color: "#579BFC" },
            { id: "p105", title: "", color: "#C4C4C4" },
        ],
        "labels": [],
        "members": [
            {
                "_id": "m101",
                "fullname": "SeedChris",
                "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
            },
        ],
        "groups": [],
        "activities": [],
        "cmpsOrder": ["status-picker", "member-picker", "date-picker", "priority-picker", "updated-picker"],
        "description": "",
        "cmpsOption": ["status-picker", "member-picker", "date-picker", "priority-picker", "number-picker", "file-picker", "updated-picker", "checkbox-picker", "text-picker", "link-picker"]
    }
}


