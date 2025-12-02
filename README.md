Project Information

Project Name: Cloud Media Drive

Group Information: Group 61 
Lee Cheuk Fung 14084969
Chan Hiu Kwan 14078625

2. Project Introduction
TheMedia Drive is a cloud-based multimedia storage and playback platform that allows users to upload, manage, and play MP3/MP4 files online via a webpage, and supports RESTful APIs for data management and integration.

Project Structure:

server.js 

package.json

public(Static resource folder, contains logo, global CSS styles)

views (EJS pages: list.ejs, details.ejs,login.ejs, create.ejs, edit.ejs, delete.ejs,navbar.ejs)

3.cloud-based server URL
https://comp3810sef-group61.onrender.com

4.Operation guides
Login page (Facebook OAuth Authentication): Login is required to manage files.After logging in with Facebook, it will be redirected to list page.

Main List Page: After logging in, it can view all uploaded audio and video files, supporting playback, editing, and deletion.

Upload page: it can upload MP3/MP4 files, fill in the file name and description.After uploading the file, you will be redirected to list.ejs.Need to write the file name.

Edit page: Change the file name and description, or re-upload and replace the file.

Delete Function: Delete unwanted files.It will prompt to confirm deletion.

