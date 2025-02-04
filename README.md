
# Donezo - E2E clone of Monday (React + Node.js) 

[A lot of work was done to get it to even render](https://github.com/atebit/donezo/commit/61be8a3da9d381ce593b1bb7bed43ac57173ec59) which is captured in the initial commit to this new repository. Project is forked from [MyDay](https://github.com/idandavid1/My-Day). 

Table-style task management board app inspired by Monday.com, [Project link (not avail yet)](https://donezo.netlify.com/).

For those of you who are already familliar with Monday, we added some intersting and unique features - [features](#application-features).
If you are not familliar with the App, read about it [here](#monday-description).
And, if you are tired and just want to see some images of the website, [scroll to the bottom...](#showcase)


___

### Table of Contents
- [Monday Description](#monday-description)
- [Application Features](#application-features)
- [Technologies](#technologies)
- [Getting started](#getting-started)
- [Showcase](#showcase)

## Description
Manage projects and tasks using a table board. A board contains groups, lists and tasks. Usually each project is a board, and the groups and the tasks and titles to do in the project. Users can modify the board and change group and task locations using Drag and Drop.
Users can work together and watch live changes. 
There are many other features, such as status, priority, due date for tasks, members and more. 
More about it in the [features section](#application-features).

## Application Features
- Create ***Boards*** and manage projects: Using ***D&D***, create, remove, duplicate, update groups and tasks, activity log for all the activity in the board, and for each board you can remove and add task columns.
- Create and edit ***Task*** to the deepest level: statuses, priority, due date, members, file images, numbers, last updated by, duplicate, move, activity log and live chat.
- ***Groups:*** - Change the color of the group with the palette color modal using ***lodash library***.
 ***Filtering*** by members / group and task title.
- Google Login, along with regular authentication which is encrypted and safe.

Of course that we included all the small nuances Monday has. You are not supposed to find any differences! 

## Technologies

The technology stack we used was MERN - MongoDB, Express, React, Node.js.
The app uses webSockets to update the board in real-time.
The API calls to the backend are done with the REST API method.

We have used many thirs side libraries for many goals like google-login, lodash, D&D and more.
The layout and pixel-perfect were made with Sass (functions, mixins, variables). 

## Getting started

Head to the repository on top and clone the project or download the files.

```
git clone https://github.com/atebit/donezo

```

Enter the backend folder and make sure you have node_modules installed. After that we will initiate the server with 'npm start':

```
cd backend
npm i 
npm start
```

You shuold get a console ouput that the server is up and running at port 3030.
Enter the frontend folder and repeat the same process.

```
cd frontend
npm i 
npm start
```

You shuold get a console ouput that the server is up and running at `localhost:3000`.

## Showcase

### Homepage
The landing page in which the user can sign up / login, or press the call to action button to start demo if the are limited with time.


### Board
D&D, live-updates, editing tasks to the deepest level, side-menu, editing board members and much more..


### Signup
We created an e2e authentication flow, including encrypting the users' details, midelwears and ****Google Login***.


### Task details
Here the members can add messages and to follow after the activity for every task and to watch it happens live


### Some mobile!
Just a taste of the mobile experience. We used different **mixins**, **conditional rendering**, and the **"mobile first"** approach. 
The layout we have built from the very first moment enabled us to make the website responsive without a lot of effort.


### Authors
 - [Christopher Smith](https://github.com/atebit)
