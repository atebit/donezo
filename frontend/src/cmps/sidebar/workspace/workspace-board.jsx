import React from 'react'

import { BsFillLightningFill } from 'react-icons/bs'
import { IoIosArrowDown } from 'react-icons/io'
import { AiOutlinePlus, AiOutlineSearch } from 'react-icons/ai'
import { AiFillHome } from 'react-icons/ai'
import { BoardPreview } from '../../board/board-preview'

export default function WorkspaceBoard({handleChange , filterByToEdit, setIsCreateModalOpen, boards}) {
// console.log("all boards", boards)
  return (
      <div className="workspace-sidebar-header">
      <div className='workspace-sidebar-items'>
          <div className="workspace-title-container flex space-between align-center">
              <span className='workspace-title'>Workspace</span>
          </div>
          <div className='workspace-btns'>
              <div onClick={() => setIsCreateModalOpen((prev) => !prev)} >
                  <AiOutlinePlus className='icon' />
                  <span>Add New Board</span>
              </div>
              <div className='search-board'>
                  <div className='flex'>
                      <AiOutlineSearch className='icon' />
                      <input type="text"
                          name='title'
                          className='search-input'
                          value={filterByToEdit.title}
                          placeholder="Search"
                          onChange={handleChange}
                      />
                  </div>
              </div>
          </div>
      </div>
      <ul className='board-list-container flex column'>
          {boards.map(board => {
              // console.log(board.title)
              return <li key={board._id} className='board-list'>
                  <BoardPreview board={board} />
              </li>
          })}
      </ul>
  </div>
  )
}
