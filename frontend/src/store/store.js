import { combineReducers, legacy_createStore as createStore } from 'redux'

import { boardReducer } from './board.reducer' 
import { userReducer } from './user.reducer'

import structuredClone from '@ungap/structured-clone';

const rootReducer = combineReducers({
    boardModule: boardReducer,
    userModule: userReducer 
})

const middleware = (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__)? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__() : undefined
export const store = createStore(rootReducer, middleware)

// store.subscribe(() => {
//     console.log('**** Store state changed: ****')
//     console.log('storeState:\n', store.getState())
//     console.log('*******************************')
// })
