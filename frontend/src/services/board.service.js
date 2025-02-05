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
        // "priority": "",
        "memberIds": [],
        "dueDate": '',
        "comments": [],
        "updatedBy":{
            "imgUrl":"",
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
        "createdBy":{
            "fullname":"SeedChris",
            "imgUrl":"https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg",
            "_id": utilService.makeId()
        },
        "labels": [
          { id: "l101", cmpType: "status-picker", title: "Done", color: "#00C875" },
          { id: "l102", cmpType: "status-picker", title: "High Priority", color: "#E2435C" },
          { id: "l103", cmpType: "status-picker", title: "Medium Priority", color: "#FF9B15" },
          { id: "l104", cmpType: "status-picker", title: "Low Priority", color: "#ffcb00" },
          { id: "l105", cmpType: "status-picker", title: "Second High Priority", color: "#A704FF" },
          { id: "l106", cmpType: "status-picker", title: "Second Medium Priority", color: "#714AFF" },
          { id: "l107", cmpType: "status-picker", title: "Second Low Priority", color: "#32BBFF" },
          { id: "l108", cmpType: "status-picker", title: "Stuck", color: "#8F182B" },
          { id: "l109", cmpType: "status-picker", title: "Dead", color: "#3F3F3F" },
          { id: "l110", cmpType: "status-picker", title: "Empty", color: "#c4c4c4" },
        ],
        "members": [
            {
                "_id": "m101",
                "fullname": "SeedChris",
                "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
            },
        ],
        "groups": [],
        "activities": [],
        "cmpsOrder": ["status-picker", "member-picker", "date-picker", 'priority-picker', 'updated-picker'],
        "description": "",
        "cmpsOption": ["status-picker", "member-picker", "date-picker", 'priority-picker', 'number-picker', 'file-picker', 'updated-picker']
    }
}


