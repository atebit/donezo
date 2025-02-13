import { useEffect, useRef, useState } from "react"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"

import { DueDate } from "./date-picker"
import { MemberPicker } from "./member-picker"
import { PriorityPicker } from "./priority-picker"
import { StatusPicker } from "./status-picker"
import { setDynamicModalObj, toggleModal, updateTaskAction } from "../../store/board.actions"
import { UpdatedPicker } from "./updated-picker"
import { NumberPicker } from "./number-picker"
import { FilePicker } from "./file-picker"

import { TbArrowsDiagonal } from 'react-icons/tb'
import { BiDotsHorizontalRounded, BiMessageRoundedAdd } from 'react-icons/bi'
import { HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2'

import { v4 as uuidv4 } from 'uuid'

export function TaskPreview({ task, group, board, handleCheckboxChange, isMainCheckbox }) {
    const [isClick, setIsClick] = useState(false)
    const isOpen = useSelector((storeState) => storeState.boardModule.isBoardModalOpen)
    const user = useSelector(storeState => storeState.userModule.user)
    const dynamicModalObj = useSelector(storeState => storeState.boardModule.dynamicModalObj)
    const elTaskPreview = useRef(null)
    const elMenuTask = useRef()
    const navigate = useNavigate()

    const guest = "https://res.cloudinary.com/du63kkxhl/image/upload/v1675013009/guest_f8d60j.png"

    console.log("TaskPreview", task, group, board)

    useEffect(() => {
        setIsClick(isMainCheckbox.isActive)
    }, [isMainCheckbox])

    async function updateTask(columnId, data, activity) {
        const taskToUpdate = structuredClone(task)

        // console.log("TaskPreview:updateTask", columnId, data, activity)
        // Update the cell value for the given column
        taskToUpdate.cells = { ...taskToUpdate.cells, [columnId]: data }
        taskToUpdate.updatedBy.date = Date.now()
        taskToUpdate.updatedBy.imgUrl = (user && user.imgUrl) || guest
        try {
            await updateTaskAction(board, group.id, taskToUpdate, activity)
        } catch (err) {
            console.log(err)
        }
    }

    async function onUpdateTaskTitle(ev) {
        const value = ev.target.innerText
        task.title = value
        try {
            toggleOnTyping()
            await updateTaskAction(board, group.id, task)
        } catch (err) {
            console.log('Failed to save')
        }
    }

    function onOpenModal() {
        toggleModal(isOpen)
        navigate(`/board/${board._id}/${group.id}/${task.id}`)
    }

    function onCheckBoxChange() {
        handleCheckboxChange(task)
        setIsClick(!isClick)
    }

    function onToggleTaskModal() {
        const isOpen = dynamicModalObj?.task?.id === task.id && dynamicModalObj?.type === 'menu-task'
            ? !dynamicModalObj.isOpen
            : true
        const { x, y, height } = elMenuTask.current.getClientRects()[0]
        setDynamicModalObj({ isOpen, pos: { x: (x - 10), y: (y + height) }, type: 'menu-task', group, task })
    }

    function toggleOnTyping() {
        elMenuTask.current.classList.toggle('on-typing')
        elTaskPreview.current.classList.toggle('on-typing')
    }

    return (
        <section className="task-preview flex" ref={elTaskPreview}>
            <div ref={elMenuTask} className="sticky-div" style={{ borderColor: group.color }}>
                <div className="task-menu">
                    <BiDotsHorizontalRounded className="icon" onClick={onToggleTaskModal} />
                </div>
                <div className="check-box">
                    <input type="checkbox" checked={isClick} onChange={onCheckBoxChange} />
                </div>
                <div className="task-title picker flex align-center space-between">
                    <blockquote contentEditable onFocus={toggleOnTyping}
                        onBlur={onUpdateTaskTitle} suppressContentEditableWarning={true}>
                        <span>{task.title}</span>
                    </blockquote>
                    <div className="open-task-details" onClick={onOpenModal}>
                        <TbArrowsDiagonal />
                        <span className="open-btn">Open</span>
                    </div>
                    <div onClick={onOpenModal} className="chat-icon">
                        {task.comments.length > 0 &&
                            <div>
                                <HiOutlineChatBubbleOvalLeft className="comment-chat" />
                                <div className="count-comment">{task.comments.length}</div>
                            </div>
                        }
                        {task.comments.length === 0 && <BiMessageRoundedAdd className="icon" />}
                    </div>
                </div>
            </div>
            {board.columns.map((column, idx) => {
                const key = `${column.id}-${idx}`;
                return (
                    <DynamicCmp
                        key={key}
                        column={column}
                        info={task}
                        onUpdate={updateTask}
                    />
                )
            })}
            <div className="empty-div"></div>
        </section>
    )
}

function DynamicCmp({ column, info, onUpdate }) {
    switch (column.type) {
        case "status-picker":
            return <StatusPicker info={info} columnId={column.id} onUpdate={onUpdate} />
        case "member-picker":
            return <MemberPicker info={info} columnId={column.id} onUpdate={onUpdate} />
        case "date-picker":
            return <DueDate info={info} columnId={column.id} onUpdate={onUpdate} />
        case "priority-picker":
            return <PriorityPicker info={info} columnId={column.id} onUpdate={onUpdate} />
        case "number-picker":
            return <NumberPicker info={info} columnId={column.id} onUpdate={onUpdate} />
        case "file-picker":
            return <FilePicker info={info} columnId={column.id} onUpdate={onUpdate} />
        case "updated-picker":
            return <UpdatedPicker info={info} columnId={column.id} onUpdate={onUpdate} />
        default:
            return (
                <section role="contentinfo" className="status-priority-picker picker">
                    <span style={{ color: '#000' }}>{info.cells && info.cells[column.id] ? info.cells[column.id] : ''}*</span>
                </section>
            )
    }
}
