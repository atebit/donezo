import {userReducer}  from '../store/user.reducer.js';

describe('userReducer', () => {

    const mockUser = {fullname: "SeedChris", imgUrl: "https://res.cloudinary.com/dnc31jftb/image/upload/c_thumb,w_200,g_face/v1738757693/chrispic2_ub4t3b.jpg", _id: "63eccc56d710bb63bcad0813"}
    const initialState = {
        user: null
    }

    it('creates initial state', async () => {
        const state = userReducer(initialState)
        expect(state).toBe(initialState)
    })

    it('should set a user in the state', async () => {
        let state = userReducer(initialState)
        expect(state.user).toBeFalsy()

        state = userReducer(initialState, {type: 'SET_USER', user: mockUser})
        expect(state.user).toBeTruthy()
        // expect(state.error).toBeFalsy()
    })
})