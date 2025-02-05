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

  // When board.labels changes, update the local state
  useEffect(() => {
    setEditedLabels(board.labels)
  }, [board.labels])

  function onClickModal(labelTitle) {
    dynamicModalObj.activity.action = dynamicModalObj.type
    dynamicModalObj.activity.to = board.labels.find(label => label.title === labelTitle)
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

// function onSaveLabels() {
//   let changedLabelInfo = null;
//   for (let i = 0; i < board.labels.length; i++) {
//     if (board.labels[i].title.trim() !== editedLabels[i].title.trim()) {
//       // If cmpType is undefined in editedLabels[i], default to the first element in board.cmpsOrder
//       changedLabelInfo = {
//         cmpType: editedLabels[i].cmpType || (board.cmpsOrder && board.cmpsOrder[0]),
//         oldTitle: board.labels[i].title,
//         newTitle: editedLabels[i].title
//       };
//       break; // Process only the first change for now.
//     }
//   }
//   const updatedBoard = { ...board, labels: editedLabels };
//   dispatch(updateBoardAction(updatedBoard, changedLabelInfo));
//   setIsEditing(false);
// }


  function onSaveLabels() {
    let changedLabelInfo = null;
    // console.log('ModalStatusPriority.onSaveLabels');
    for (let i = 0; i < board.labels.length; i++) {
      if (board.labels[i].title.trim() !== editedLabels[i].title.trim()) {
        changedLabelInfo = {
          cmpType: 'status-picker',
          oldTitle: board.labels[i].title,
          newTitle: editedLabels[i].title
        };
        console.log('ModalStatusPriority.onSaveLabels changedLabelInfo', changedLabelInfo);
        break;
      }
    }
    const updatedBoard = { ...board, labels: editedLabels };
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
            : board.labels.map((label, idx) => (
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



// import { useState, useEffect } from 'react'
// import { useSelector, useDispatch } from 'react-redux'
// import { setDynamicModalObj, updateBoardAction } from '../../store/board.actions'
// import { RxPencil1 } from 'react-icons/rx'
// import { VscTriangleUp } from 'react-icons/vsc'

// export function ModalStatusPriority({ dynamicModalObj }) {
//     const board = useSelector(storeState => storeState.boardModule.board)
//     const dispatch = useDispatch()
//     const [isEditing, setIsEditing] = useState(false)
//     const [editedLabels, setEditedLabels] = useState([])

//     // Whenever board.labels updates, refresh local editedLabels.
//     useEffect(() => {
//         setEditedLabels(board.labels)
//     }, [board.labels])

//     function onClickModal(labelTitle) {
//         // In view mode, clicking a label triggers the status/priority update.
//         dynamicModalObj.activity.action = dynamicModalObj.type
//         dynamicModalObj.activity.to = board.labels.find(label => label.title === labelTitle)
//         dynamicModalObj.onTaskUpdate(dynamicModalObj.type, labelTitle, dynamicModalObj.activity)
//         dynamicModalObj.isOpen = false
//         setDynamicModalObj(dynamicModalObj)
//     }

//     function handleLabelChange(idx, ev) {
//         const newTitle = ev.target.value
//         setEditedLabels(prevLabels => {
//             const newLabels = [...prevLabels]
//             newLabels[idx] = { ...newLabels[idx], title: newTitle }
//             return newLabels
//         })
//     }

//     function onSaveLabels() {
//         // Detect changes between the current board.labels and the edited labels.
//         let changedLabelInfo = null
//         for (let i = 0; i < board.labels.length; i++) {
//             if (board.labels[i].title !== editedLabels[i].title) {
//                 changedLabelInfo = {
//                     cmpType: editedLabels[i].cmpType,
//                     oldTitle: board.labels[i].title,
//                     newTitle: editedLabels[i].title
//                 }
//                 break // Process only the first changed label
//             }
//         }
//         const updatedBoard = { ...board, labels: editedLabels }
//         // Dispatch the action with the updated board and any label change info.
//         dispatch(updateBoardAction(updatedBoard, changedLabelInfo))
//         setIsEditing(false)
//     }

//     return (
//         <section className="modal-status-priority">
//             <VscTriangleUp className="triangle-icon" />
//             <section className="modal-status-priority-content">
//                 <ul>
//                     {isEditing
//                         ? editedLabels.map((label, idx) => (
//                               <li key={idx} style={{ backgroundColor: label.color }}>
//                                   <input
//                                       type="text"
//                                       value={label.title}
//                                       onChange={(ev) => handleLabelChange(idx, ev)}
//                                   />
//                               </li>
//                           ))
//                         : board.labels.map((label, idx) => (
//                               <li
//                                   key={idx}
//                                   style={{ backgroundColor: label.color }}
//                                   onClick={() => onClickModal(label.title)}
//                               >
//                                   {label.title}
//                               </li>
//                           ))}
//                 </ul>
//                 <div className="edit-labels-btn">
//                     {isEditing ? (
//                         <button onClick={onSaveLabels}>
//                             <RxPencil1 className="icon" />
//                             <span>Save Changes</span>
//                         </button>
//                     ) : (
//                         <button onClick={() => setIsEditing(true)}>
//                             <RxPencil1 className="icon" />
//                             <span>Edit Labels</span>
//                         </button>
//                     )}
//                 </div>
//             </section>
//         </section>
//     )
// }



// // import { useState, useEffect } from 'react'
// // import { useSelector, useDispatch } from 'react-redux'
// // import { setDynamicModalObj, updateBoardAction } from '../../store/board.actions'
// // import { RxPencil1 } from 'react-icons/rx'
// // import { VscTriangleUp } from 'react-icons/vsc'

// // export function ModalStatusPriority({ dynamicModalObj }) {
// //     const board = useSelector(storeState => storeState.boardModule.board)
// //     const dispatch = useDispatch()
// //     // local state for toggling edit mode and tracking label title changes
// //     const [isEditing, setIsEditing] = useState(false)
// //     const [editedLabels, setEditedLabels] = useState([])

// //     // When board.labels changes, update the local state
// //     useEffect(() => {
// //         setEditedLabels(board.labels)
// //     }, [board.labels])

// //     function onClickModal(labelTitle) {
// //         // In view mode, clicking a label will perform the status/priority update.
// //         dynamicModalObj.activity.action = dynamicModalObj.type
// //         dynamicModalObj.activity.to = board.labels.find(label => label.title === labelTitle)
// //         dynamicModalObj.onTaskUpdate(dynamicModalObj.type, labelTitle, dynamicModalObj.activity)
// //         dynamicModalObj.isOpen = false
// //         setDynamicModalObj(dynamicModalObj)
// //     }

// //     function handleLabelChange(idx, ev) {
// //         const newTitle = ev.target.value
// //         setEditedLabels(prevLabels => {
// //             const newLabels = [...prevLabels]
// //             newLabels[idx] = { ...newLabels[idx], title: newTitle }
// //             return newLabels
// //         })
// //     }

// //     function onSaveLabels() {
// //         // Compare the original board.labels with editedLabels to detect a change.
// //         // Here, for simplicity, we assume only one label change.
// //         let changedLabelInfo = null;
// //         for (let i = 0; i < board.labels.length; i++) {
// //             if (board.labels[i].title !== editedLabels[i].title) {
// //                 changedLabelInfo = {
// //                     cmpType: editedLabels[i].cmpType,
// //                     oldTitle: board.labels[i].title,
// //                     newTitle: editedLabels[i].title
// //                 }
// //                 break; // Process the first change only
// //             }
// //         }
// //         const updatedBoard = { ...board, labels: editedLabels }
// //         // Dispatch updateBoardAction with changedLabelInfo if any label has changed.
// //         dispatch(updateBoardAction(updatedBoard, changedLabelInfo))
// //         setIsEditing(false)
// //     }

// //     return (
// //         <section className="modal-status-priority">
// //             <VscTriangleUp className="triangle-icon" />
// //             <section className="modal-status-priority-content">
// //                 <ul>
// //                     {isEditing
// //                         ? editedLabels.map((label, idx) => (
// //                               <li key={idx} style={{ backgroundColor: label.color }}>
// //                                   <input
// //                                       type="text"
// //                                       value={label.title}
// //                                       onChange={(ev) => handleLabelChange(idx, ev)}
// //                                   />
// //                               </li>
// //                           ))
// //                         : board.labels.map((label, idx) => (
// //                               <li
// //                                   onClick={() => onClickModal(label.title)}
// //                                   key={idx}
// //                                   style={{ backgroundColor: label.color }}
// //                               >
// //                                   {label.title}
// //                               </li>
// //                           ))}
// //                 </ul>
// //                 <div className="edit-labels-btn">
// //                     {isEditing ? (
// //                         <button onClick={onSaveLabels}>
// //                             <RxPencil1 className="icon" />
// //                             <span>Save Changes</span>
// //                         </button>
// //                     ) : (
// //                         <button onClick={() => setIsEditing(true)}>
// //                             <RxPencil1 className="icon" />
// //                             <span>Edit Labels</span>
// //                         </button>
// //                     )}
// //                 </div>
// //             </section>
// //         </section>
// //     )
// // }