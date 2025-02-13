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

  // When board.labels changes, update local state.
  useEffect(() => {
    setEditedLabels(board.labels)
  }, [board.labels])

  function onClickModal(labelId, labelTitle) {

    dynamicModalObj.labelId = labelId
    dynamicModalObj.activity.action = dynamicModalObj.type
    dynamicModalObj.activity.to = board.labels.find(label => label.title === labelTitle)
    // Attach the column id so that the update action knows which cell to update.
    dynamicModalObj.activity.columnId = dynamicModalObj.columnId
    dynamicModalObj.onTaskUpdate(dynamicModalObj.type, labelTitle, dynamicModalObj.activity)
    dynamicModalObj.isOpen = false
    console.log('click modal',dynamicModalObj)
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
    let changedLabelInfo = null
    for (let i = 0; i < board.labels.length; i++) {
      if (board.labels[i].title.trim() !== editedLabels[i].title.trim()) {
        changedLabelInfo = {
          cmpType: 'status-picker',
          oldTitle: board.labels[i].title,
          newTitle: editedLabels[i].title
        }
        break // Process only the first change
      }
    }
    const updatedBoard = { ...board, labels: editedLabels }
    dispatch(updateBoardAction(updatedBoard, changedLabelInfo))
    setIsEditing(false)
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
            : board.labels.map((label, idx) => (
                <li
                  key={idx}
                  style={{ backgroundColor: label.color }}
                  onClick={() => onClickModal(label.id, label.title)}
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


// import { useState, useEffect } from 'react'
// import { useSelector, useDispatch } from 'react-redux'
// import { setDynamicModalObj, updateBoardAction } from '../../store/board.actions'
// import { RxPencil1 } from 'react-icons/rx'
// import { VscTriangleUp } from 'react-icons/vsc'

// export function ModalStatusPriority({ dynamicModalObj }) {
//   const board = useSelector(storeState => storeState.boardModule.board)
//   const dispatch = useDispatch()
//   const [isEditing, setIsEditing] = useState(false)
//   const [editedLabels, setEditedLabels] = useState([])

//   // When board.labels changes, update the local state
//   useEffect(() => {
//     setEditedLabels(board.labels)
//   }, [board.labels])

//   function onClickModal(labelId, labelTitle) {
//     dynamicModalObj.labelId = labelId;
//     dynamicModalObj.activity.action = dynamicModalObj.type
//     dynamicModalObj.activity.to = board.labels.find(label => label.title === labelTitle)
//     dynamicModalObj.onTaskUpdate(dynamicModalObj.type, labelTitle, dynamicModalObj.activity)
//     dynamicModalObj.isOpen = false
//     // console.log("ModalStatusPriority:onClickModal", dynamicModalObj, labelTitle, board);
//     setDynamicModalObj(dynamicModalObj)
//   }

//   function handleLabelChange(idx, ev) {
//     const newTitle = ev.target.value
//     setEditedLabels(prevLabels => {
//       const newLabels = [...prevLabels]
//       newLabels[idx] = { ...newLabels[idx], title: newTitle }
//       return newLabels
//     })
//   }

//   function onSaveLabels() {
//     let changedLabelInfo = null;
//     // console.log('ModalStatusPriority.onSaveLabels');
//     for (let i = 0; i < board.labels.length; i++) {
//       if (board.labels[i].title.trim() !== editedLabels[i].title.trim()) {

//         // TODO: May need to have a dynamic cmpType here...
        
//         changedLabelInfo = {
//           cmpType: 'status-picker',
//           oldTitle: board.labels[i].title,
//           newTitle: editedLabels[i].title
//         };
//         // console.log('ModalStatusPriority.onSaveLabels changedLabelInfo', changedLabelInfo);
//         break;
//       }
//     }
//     const updatedBoard = { ...board, labels: editedLabels };
//     dispatch(updateBoardAction(updatedBoard, changedLabelInfo));
//     setIsEditing(false);
//   }

//   return (
//     <section className="modal-status-priority">
//       <VscTriangleUp className="triangle-icon" />
//       <section className="modal-status-priority-content">
//         <ul>
//           {isEditing
//             ? editedLabels.map((label, idx) => (
//                 <li key={idx} style={{ backgroundColor: label.color }}>
//                   <input
//                     type="text"
//                     value={label.title}
//                     onChange={(ev) => handleLabelChange(idx, ev)}
//                   />
//                 </li>
//               ))
//             : board.labels.map((label, idx) => (
//                 <li
//                   key={idx}
//                   style={{ backgroundColor: label.color }}
//                   onClick={() => onClickModal(label.id, label.title)}
//                 >
//                   {label.title}
//                 </li>
//               ))}
//         </ul>
//         <div className="edit-labels-btn">
//           {isEditing ? (
//             <button onClick={onSaveLabels}>
//               <RxPencil1 className="icon" />
//               <span>Save Changes</span>
//             </button>
//           ) : (
//             <button onClick={() => setIsEditing(true)}>
//               <RxPencil1 className="icon" />
//               <span>Edit Labels</span>
//             </button>
//           )}
//         </div>
//       </section>
//     </section>
//   )
// }

