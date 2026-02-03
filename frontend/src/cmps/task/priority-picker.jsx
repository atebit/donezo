import { useRef } from "react"
import { useSelector } from "react-redux"
import { boardService } from "../../services/board.service"
import { setDynamicModalObj } from "../../store/board.actions"

export function PriorityPicker({ info, onUpdate }) {
    const board = useSelector(storeState => storeState.boardModule.board)
    const dynamicModalObj = useSelector(storeState => storeState.boardModule.dynamicModalObj)
    const elPrioritySection = useRef()

    // Use priorityLabels with fallback to labels for backward compatibility
    const priorityLabels = board.priorityLabels || board.labels || []
    const label = priorityLabels.find(label => label.title === info.priority)
    const color = label ? label.color : '#c4c4c4'
    const activity = boardService.getEmptyActivity()
    activity.from = label
    activity.task = { id: info.id, title: info.title }

    const priority = info.priority;

    function onToggleMenuModal() {
        const isOpen = dynamicModalObj?.task?.id === info.id && dynamicModalObj?.type === 'priority' ? !dynamicModalObj.isOpen : true
        const { x, y } = elPrioritySection.current.getClientRects()[0]
        setDynamicModalObj({ isOpen, pos: { x: (x - 35), y: (y + 38) }, type: 'priority', task: info, onTaskUpdate: onUpdate, activity: activity, cmpType: 'priority-picker' })
    }
    return <section ref={elPrioritySection} className="status-priority-picker picker" style={{ backgroundColor: color }} onClick={onToggleMenuModal}>
        <div>{priority}</div>
        <span className="fold"></span>
    </section>
}