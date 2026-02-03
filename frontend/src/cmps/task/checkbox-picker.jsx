import { useState } from "react"
import { BsCheckSquare, BsSquare } from "react-icons/bs"
import { boardService } from "../../services/board.service"

export function CheckboxPicker({ info, onUpdate }) {
    const [isChecked, setIsChecked] = useState(info.checkbox || false)
    const activity = boardService.getEmptyActivity()

    activity.action = 'checkbox'
    activity.from = info.checkbox || false
    activity.task = { id: info.id, title: info.title }

    function onToggleCheckbox() {
        const newValue = !isChecked
        setIsChecked(newValue)
        activity.to = newValue
        onUpdate('checkbox', newValue, activity)
    }

    return (
        <section className="checkbox-picker picker" onClick={onToggleCheckbox}>
            <div className="checkbox-content">
                {isChecked ? (
                    <BsCheckSquare className="checkbox-icon checked" />
                ) : (
                    <BsSquare className="checkbox-icon" />
                )}
            </div>
        </section>
    )
}
