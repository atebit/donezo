import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { setDynamicModalObj, updateBoardAction } from '../../store/board.actions'
import { RxPencil1 } from 'react-icons/rx'
import { VscTriangleUp } from 'react-icons/vsc'

export function ModalStatusPriority({ dynamicModalObj }) {
  const board = useSelector(storeState => storeState.boardModule.board)
  const dispatch = useDispatch()
  const [isEditing, setIsEditing] = useState(false)
  const [editedLabels, setEditedLabels] = useState([])

  // Determine which labels to use based on cmpType
  const cmpType = dynamicModalObj.cmpType || (dynamicModalObj.type === 'priority' ? 'priority-picker' : 'status-picker')
  const isStatusPicker = cmpType === 'status-picker'
  
  // Get the appropriate labels array with fallback
  const currentLabels = isStatusPicker 
    ? (board.statusLabels || board.labels || [])
    : (board.priorityLabels || board.labels || [])

  // When labels change, update the local state
  useEffect(() => {
    setEditedLabels(currentLabels)
  }, [board.statusLabels, board.priorityLabels, board.labels, cmpType])

  function onClickModal(labelTitle) {
    dynamicModalObj.activity.action = dynamicModalObj.type
    dynamicModalObj.activity.to = currentLabels.find(label => label.title === labelTitle)
    dynamicModalObj.onTaskUpdate(dynamicModalObj.type, labelTitle, dynamicModalObj.activity)
    dynamicModalObj.isOpen = false
    setDynamicModalObj(dynamicModalObj)
  }

  function handleLabelChange(idx, ev) {
    const newTitle = ev.target.value
    setEditedLabels(prevLabels => {
      const newLabels = [...prevLabels]
      newLabels[idx] = { ...newLabels[idx], title: newTitle }
      return newLabels
    })
  }

  function onSaveLabels() {
    let changedLabelInfo = null;
    
    for (let i = 0; i < currentLabels.length; i++) {
      if (currentLabels[i].title.trim() !== editedLabels[i].title.trim()) {
        changedLabelInfo = {
          cmpType: cmpType,
          oldTitle: currentLabels[i].title,
          newTitle: editedLabels[i].title
        };
        break;
      }
    }
    
    // Update the correct labels array based on cmpType
    const updatedBoard = isStatusPicker
      ? { ...board, statusLabels: editedLabels }
      : { ...board, priorityLabels: editedLabels };
    
    dispatch(updateBoardAction(updatedBoard, changedLabelInfo));
    setIsEditing(false);
  }

  return (
    <section className="modal-status-priority">
      <VscTriangleUp className="triangle-icon" />
      <section className="modal-status-priority-content">
        <ul>
          {isEditing
            ? editedLabels.map((label, idx) => (
                <li key={idx} style={{ backgroundColor: label.color }}>
                  <input
                    type="text"
                    value={label.title}
                    onChange={(ev) => handleLabelChange(idx, ev)}
                  />
                </li>
              ))
            : currentLabels.map((label, idx) => (
                <li
                  key={idx}
                  style={{ backgroundColor: label.color }}
                  onClick={() => onClickModal(label.title)}
                >
                  {label.title}
                </li>
              ))}
        </ul>
        <div className="edit-labels-btn">
          {isEditing ? (
            <button onClick={onSaveLabels}>
              <RxPencil1 className="icon" />
              <span>Save Changes</span>
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)}>
              <RxPencil1 className="icon" />
              <span>Edit Labels</span>
            </button>
          )}
        </div>
      </section>
    </section>
  )
}

