# My Week 🗓️

A small timetable app for lectures, study, German and guitar. It works offline and you can install it on your desktop or phone.

## Features
- **Now / Next card**: shows what you should be doing right now, how many minutes are left, and what's coming next.
- **Weekly progress**: tick blocks as done and see your study, German, guitar and lecture hours fill up. Ticks reset automatically every Monday.
- **Editable timetable**: tap any slot to change the activity, add a note, or make it free. Changes are saved in your browser.
- **Reminders**: optional notification 5 minutes before each block. They only arrive while the app is open, even in the background.
- **Backup**: export or import your timetable as a JSON file from the ⋯ menu.
- Dark mode, a mobile day view, and offline support.

## Put it on GitHub Pages
1. Create a new repository on GitHub, for example `my-week`.
2. Upload all the files in this folder, including the `icons` folder, to the repository root.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After about a minute your app is live at `https://<your-username>.github.io/my-week/`.

## Install it / bookmark it
- **Chrome or Edge (Windows/Mac/Linux):** open the link and click the install icon in the address bar (or ⋮ → *Install My Week*). It gets its own window and a desktop/Start-menu shortcut.
- **Safari on Mac:** File → *Add to Dock*.
- **iPhone:** Share → *Add to Home Screen*.
- **Android:** ⋮ → *Install app* / *Add to Home screen*.
- Or just bookmark the link.

## Customising
- To change the starting timetable, edit `DEFAULT_SCHEDULE` in `app.js`. Then use ⋯ → *Restore original timetable* in the app.
- To change the visible hours, edit `START_HOUR` and `END_HOUR` in `app.js`. To add a category, edit `CATS` and add its colours in `style.css`.
- After you change files, bump `CACHE` in `sw.js` (e.g. `my-week-v2`) so installed copies pick up the update.

Your data stays in your browser (localStorage). Nothing is uploaded anywhere.
