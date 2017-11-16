# React + RxDB + Pouch example

This offline PWA example shows how to connect to a remote encrypted [PouchDB](http://pouchdb.com) instance and sync a database of images.

Works better on Android (services workers)

# Pouch instance :

Get a pouchdb instance with `docker run -it  -p 5984:5984 filiosoft/pouchdb`

or deploy the [Dockerfile](./docker/Dockerfile) to now.sh

# Credits

https://blog.logrocket.com/building-an-offline-first-app-with-react-and-rxdb-e97a1fa64356