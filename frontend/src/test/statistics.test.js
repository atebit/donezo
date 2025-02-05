import { render, screen } from '@testing-library/react'
import { StatisticGroup } from '../cmps/board/statistics-group'

const mockBoard = {
    "_id": "b101",
    "labels": [
        {
            "id": "l101",
            "title": "Done",
            "color": "#00c875"
        },
        {
            "id": "l102",
            "title": "Progress",
            "color": "#fdab3d"
        },
        {
            "id": "l103",
            "title": "Stuck",
            "color": "#e2445c"
        },
        {
            "id": "l104",
            "title": "Low",
            "color": "#ffcb00"
        },
        {
            "id": "l105",
            "title": "Medium",
            "color": "#a25ddc"
        },
        {
            "id": "l106",
            "title": "High",
            "color": "#e2445c"
        },
        {
            "id": "l107",
            "title": "",
            "color": "#c4c4c4"
        },
    ],
    "members": [
        {
            "id": "m101",
            "fullname": "SeedChris",
            "imgUrl": "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg"
        },
    ],
    "groups": [{
        "id": "g101",
        "title": "Group 1",
        "archivedAt": 1589983468418,
        "tasks": [
            {
                "id": "c101",
                "title": "Replace logo",
                "status": "Stuck",
                "priority": "Medium",
                "memberIds": ["m101", "m102", "m103"],
                "dueDate": 1615621,
                "number": 10,
            },
            {
                "id": "c102",
                "title": "Add Samples",
                "status": "Done",
                "priority": "Low",
                "memberIds": ["m101"],
                "dueDate": 16156211111,
                "number": 20,
            },
        ],
        "color": '#66ccff'
    },
    ],
    "activities": [],
    "cmpsOrder": ["member-picker", "status-picker", "date-picker", 'priority-picker']
}

describe('statistics context', () => {

    it('test number statistic', () => {
        render(<StatisticGroup cmpType={'number-picker'} group={mockBoard.groups[0]} board={mockBoard} />)
        const divEl = screen.getByRole('contentinfo')
        expect(divEl).toBeInTheDocument()
        expect(divEl).toHaveTextContent(/30/)
    })

    it('status statistic labels', () => {
        render(<StatisticGroup cmpType={'status-picker'} group={mockBoard.groups[0]} board={mockBoard} />)
        const spanElements = screen.getAllByTestId(/label/)
        const firstSpanElement = screen.getByTestId('label-0')
        expect(spanElements.length).toBe(2)
        expect(firstSpanElement).toHaveStyle("width: 50%")
    })

    it("should return empty fragment", () => {
        const { asFragment } = render(<StatisticGroup cmpType={'member-picker'} group={mockBoard.groups[0]} board={mockBoard} />)
        expect(asFragment()).toMatchInlineSnapshot(`<DocumentFragment />`)
    })
})
