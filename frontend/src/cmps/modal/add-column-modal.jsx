import { ImFilesEmpty } from 'react-icons/im'
import { CiCalculator2, CiCalendarDate } from 'react-icons/ci'
import { RxCountdownTimer } from "react-icons/rx"
import { BsCheckSquare } from "react-icons/bs"
import { HiOutlineUserCircle } from 'react-icons/hi'
import { loadBoard, saveBoard, setDynamicModalObj } from '../../store/board.actions'
import { useSelector } from 'react-redux'
import { utilService } from '../../services/util.service'

const statusImg = require('../../assets/img/status.png')

export function AddColumnModal({ dynamicModalObj }) {
  const board = useSelector(storeState => storeState.boardModule.filteredBoard)
  // console.log("AddColumnModal board:", board)
  // console.log("AddColumnModal > Dynamic modal object:", dynamicModalObj)

  // Define a default list of all available column types.
  const availableColumnTypes = [
    'status-picker',
    'date-picker',
    'member-picker',
    'number-picker',
    'updated-picker',
    'checkbox-picker'
  ];

  // Helper to get a default title based on column type
  function getDefaultTitle(columnType) {
    // console.log("AddColumnModal:getDefaultTitle", columnType)
    let title = '';
    switch (columnType) {
      case 'status-picker':
        title = 'Status'
        break;
      case 'date-picker':
        title = 'Date'
        break;
      case 'member-picker':
        title = 'Person'
        break;
      case 'number-picker':
        title = 'Number'
        break;
      case 'updated-picker':
        title = 'Updated'
        break;
      case 'checkbox-picker':
        title = 'Checkbox'
        break;
    }
    return title + " " + board.columns.length
  }

  async function addColumn(columnType) {
    // console.log("AddColumnModal:addColumn", columnType)
    try {
      // Ensure board.columns exists; if not, initialize as empty array.
      if (!board.columns) board.columns = []
      
      // Create a new column object.
      const newColumn = {
        id: utilService.makeId(),
        type: columnType,
        title: getDefaultTitle(columnType)
      }
      board.columns.push(newColumn)
      
      // Save and reload the board.
      await saveBoard(board)
      loadBoard(board._id)
      
      // Close the modal.
      dynamicModalObj.isOpen = false
      setDynamicModalObj(dynamicModalObj)
    } catch (err) {
      console.log(err)
    }
  }

  function getIconAction(column) {
    // console.log("AddColumnModal:getIconAction", column)
    switch (column) {
      case 'status-picker':
        return (
          <div onClick={() => addColumn('status-picker')}>
            <img src={statusImg} alt="status" />
            Status
          </div>
        )
      case 'date-picker':
        return (
          <div onClick={() => addColumn('date-picker')}>
            <CiCalendarDate className="icon" />
            Date
          </div>
        )
      case 'member-picker':
        return (
          <div onClick={() => addColumn('member-picker')}>
            <HiOutlineUserCircle className="icon" />
            Person
          </div>
        )
      case 'number-picker':
        return (
          <div onClick={() => addColumn('number-picker')}>
            <CiCalculator2 className="icon" />
            Numbers
          </div>
        )
      case 'updated-picker':
        return (
          <div onClick={() => addColumn('updated-picker')}>
            <RxCountdownTimer className="icon" />
            Updated
          </div>
        )
      case 'checkbox-picker':
        return (
          <div onClick={() => addColumn('checkbox-picker')}>
            <BsCheckSquare className="icon" />
            Checkbox
          </div>
        )
      default:
        return <div>Unknown Column</div>
    }
  }

  if (!dynamicModalObj.isOpen) return <div></div>
  return (
    <ul className="add-column-modal">
      {availableColumnTypes.map((column, idx) => (
        <li key={idx}>{getIconAction(column)}</li>
      ))}
    </ul>
  )
}