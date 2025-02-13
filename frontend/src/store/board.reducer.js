import { boardService } from "../services/board.service"

export const SET_BOARDS = 'SET_BOARDS'
export const SET_BOARD = 'SET_BOARD'
export const SET_FILTER_BOARD = 'SET_FILTER_BOARD'
export const REMOVE_BOARD = 'REMOVE_BOARD'
export const ADD_BOARD = 'ADD_BOARD'
export const UPDATE_BOARD = 'UPDATE_BOARD'
export const SET_FILTER = 'SET_FILTER'
export const ADD_GROUP = 'ADD_GROUP'
export const SET_MODAL = 'SET_MODAL'
export const REMOVE_GROUP = 'REMOVE_GROUP'
export const SET_DYNAMIC_MODAL = 'SET_DYNAMIC_MODAL'

const initialState = {
    boards: [],
    filteredBoard: null,
    board: null,
    isBoardModalOpen: false,
    dynamicModalObj: { isOpen: false, pos: { x: '', y: '' }, type: '' },
    filter: boardService.getDefaultFilterBoard()
}

export function boardReducer(state = initialState, action) {
    let boards
    switch (action.type) {
        case SET_BOARDS:
            return { ...state, boards: action.boards }
        case SET_BOARD:
            return { ...state, board: { ...action.board } }
        case SET_FILTER_BOARD:
            return { ...state, filteredBoard: { ...action.filteredBoard } }
        case REMOVE_BOARD:
            boards = state.boards.filter(board => board._id !== action.boardId)
            return { ...state, boards }
        case ADD_BOARD:
            boards = [action.board, ...state.boards]
            return { ...state, boards }



case UPDATE_BOARD: {
    console.log("UPDATE_BOARD", action)
  let updatedBoard = { ...action.board };

  if (action.changedLabelInfo) {
    const { cmpType, oldTitle, newTitle } = action.changedLabelInfo;
    // Retrieve the columnId from the action, if available.
    const columnId = action.changedLabelInfo.columnId || action.columnId;
    
    updatedBoard.groups = updatedBoard.groups.map(group => {
      const updatedTasks = group.tasks.map(task => {
        // Ensure task.cells is an object
        const cells = task.cells ? { ...task.cells } : {};

        // If we have a columnId from the modal, try to update that cell.
        if (columnId) {
          if (cells.hasOwnProperty(columnId)) {
            if (
              cells[columnId] &&
              cells[columnId].toString().trim().toLowerCase() === oldTitle.trim().toLowerCase()
            ) {
              cells[columnId] = newTitle;
            }
            // Return the task with the updated cells.
            return { ...task, cells };
          }
          // Fallback: if the cell keyed by columnId doesn't exist, check if task.status exists.
        }
        if (
          cmpType === 'status-picker' &&
          task.status &&
          task.status.trim().toLowerCase() === oldTitle.trim().toLowerCase()
        ) {
          return { ...task, status: newTitle };
        }
        return task;
      });
      return { ...group, tasks: updatedTasks };
    });
  }

  const updatedBoards = state.boards.map(b =>
    b._id === updatedBoard._id ? updatedBoard : b
  );
  return {
    ...state,
    boards: updatedBoards,
    board: { ...updatedBoard },
    filteredBoard: { ...updatedBoard }
  };
}




        case SET_MODAL:
            return { ...state, isBoardModalOpen: action.isOpen }
        case SET_FILTER:
            return { ...state, filter: action.filter }
        case SET_DYNAMIC_MODAL: {
            // console.log("BoardReducer:SET_DYNAMIC_MODAL",action.dynamicModalObj )
            console.log("SET_DYNAMIC_MODAL", action)
            return { ...state, dynamicModalObj: action.dynamicModalObj }
        }
        default:
            return state
    }
}
