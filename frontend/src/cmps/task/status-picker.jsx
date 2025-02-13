import { useRef } from "react"
import { useSelector } from "react-redux"
import { boardService } from "../../services/board.service"
import { setDynamicModalObj } from "../../store/board.actions"

export function StatusPicker({ info, columnId, onUpdate }) {
  const dynamicModalObj = useSelector(storeState => storeState.boardModule.dynamicModalObj)
  const board = useSelector(storeState => storeState.boardModule.board)
  const activity = boardService.getEmptyActivity()
  const elStatusSection = useRef()

  // Fallback: if there's no cell for the given columnId, use info.status.
  const cellValue = (info.cells && info.cells[columnId]) || info.status || ""
  // Try to find a label using the cellValue as an id.
  let label = board.labels.find(l => l.id === cellValue)
  // Fallback: if not found, try matching by title (case-insensitive).
  if (!label && cellValue) {
    label = board.labels.find(l => l.title.trim().toLowerCase() === cellValue.trim().toLowerCase())
  }
  const displayTitle = label ? label.title : ""
  const color = label ? label.color : "#c4c4c4"

  activity.from = label
  activity.task = { id: info.id, title: info.title }

  function onToggleMenuModal() {
    const isOpen =
      dynamicModalObj?.task?.id === info.id && dynamicModalObj?.type === 'status'
        ? !dynamicModalObj.isOpen
        : true
    const { x, y } = elStatusSection.current.getClientRects()[0]
    setDynamicModalObj({
      isOpen,
      pos: { x: x - 35, y: y + 38 },
      type: 'status',
      task: info,
      columnId,
      onTaskUpdate: onUpdate,
      activity
    })
  }

  return (
    <section
      role="contentinfo"
      ref={elStatusSection}
      className="status-priority-picker picker"
      style={{ backgroundColor: color }}
      onClick={onToggleMenuModal}>
      <div className="label-text">{displayTitle}</div>
      <span className="fold"></span>
    </section>
  )
}