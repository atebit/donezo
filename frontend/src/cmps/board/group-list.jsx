import { DragDropContext, Droppable } from 'react-beautiful-dnd'
import { GroupPreview } from './group-preview'
import { handleOnDragEnd } from "../../store/board.actions"
import { useRef } from 'react'

export function GroupList({ board }) {
  const containerRef = useRef()

  function getCellWidth() {
    // Use board.columns if available; otherwise, fallback to board.cmpsOrder.
    let columns = board.columns;
    if (!columns && board.cmpsOrder) {
      // Transform old array of strings into objects with a type property.
      columns = board.cmpsOrder.map(cmp => ({ type: cmp }));
    }
    // If still undefined, default to empty array.
    columns = columns || [];

    // Adjust widths: for example, member-picker gets a narrower width.
    return columns.reduce((acc, col) => {
      if (col.type === 'member-picker') acc += 87;
      else acc += 139;
      return acc;
    }, 600);
  }

  if (!board.groups) return <div></div>
  return (
    <div ref={containerRef} style={{ minWidth: getCellWidth() }}>
      <DragDropContext onDragEnd={(ev) => handleOnDragEnd(ev, board)}>
        <Droppable droppableId={board._id} type='group'>
          {(droppableProvided) => (
            <section ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="group-list">
              <ul>
                {board.groups.map((group, idx) => (
                  <li key={idx}>
                    <GroupPreview idx={idx} group={group} board={board} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}
