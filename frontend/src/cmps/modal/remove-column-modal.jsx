import React from 'react'
import { useSelector } from 'react-redux'
import { FiTrash, FiEdit } from 'react-icons/fi'
import { loadBoard, saveBoard, setDynamicModalObj } from '../../store/board.actions'

export function RemoveColumnModal({dynamicModalObj}) {
    const board = useSelector(storeState => storeState.boardModule.filteredBoard)

    async function onRemoveColumn(cmpOrder) {
        try {
            board.cmpsOrder = board.cmpsOrder.filter(currCmpOrder => currCmpOrder !== cmpOrder)
            await saveBoard(board)
            loadBoard(board._id)
            dynamicModalObj.isOpen = false
            setDynamicModalObj(dynamicModalObj)
        } catch (err) {
            console.log(err)
        }
    }

    // TODO: Shouldn't just add Rename to this modal, instead create a modal for columns that adds rename and delete together as options.

    return (
        <div className="delete-modal">
                <div className="edit">
                    <FiEdit />
                    <span>Rename</span>
                </div>
                <div className="delete" onClick={() => onRemoveColumn(dynamicModalObj.cmpOrder)}>
                    <FiTrash />
                    <span>Delete</span>
                </div>
            </div>
    )
}
