import React, { Component } from "react";
import logo from "./logo.svg";
import "./App.css";
import blobUtil from "blob-util";

import * as RxDB from "rxdb";
import { QueryChangeDetector } from "rxdb";
import { schema } from "./Schema";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";

//import * as moment from "moment";

QueryChangeDetector.enable();
QueryChangeDetector.enableDebugging();

RxDB.plugin(require("pouchdb-adapter-idb"));
RxDB.plugin(require("pouchdb-adapter-memory"));
RxDB.plugin(require("rxdb/plugins/attachments"));
//RxDB.plugin(require("pouchdb-replication"));
RxDB.plugin(require("pouchdb-adapter-http"));

const syncURL = "https://docker-pouch1.now.sh/";
const dbName = "encrypted10";
const password = "12345678";

// return device storage capacity
class GetStorage extends React.Component {
  state = {
    usedBytes: 0,
    grantedBytes: 0
  };
  componentDidMount() {
    if (typeof navigator !== "undefined" && navigator.webkitTemporaryStorage) {
      navigator.webkitTemporaryStorage.queryUsageAndQuota(
        (usedBytes, grantedBytes) => {
          console.log("we are using " + usedBytes + " of " + grantedBytes + "bytes");
          this.setState({
            usedBytes,
            grantedBytes
          });
        },
        function(e) {
          console.log("Error", e);
        }
      );
    }
  }
  render() {
    return <div>{this.props.render(this.state)}</div>;
  }
}

// return some attachment
class WithRxDBAttachment extends Component {
  state = {
    url: null
  };
  componentDidMount() {
    const attachment = this.props.document.getAttachment(this.props.filename);
    if (attachment) {
      attachment.getStringData().then(url => {
        this.setState({
          url: url
        });
      });
    }
  }
  render() {
    return <div>{this.state.url && this.props.render(this.state.url)}</div>;
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      newMessage: "",
      messages: []
    };
    this.subs = [];
  }

  async createDatabase() {
    // password must have at least 8 characters
    const db = await RxDB.create({ name: dbName, adapter: "idb", password: password });

    // show who's the leader in page's title
    db.waitForLeadership().then(() => {
      document.title = "♛ " + document.title;
    });

    // create collection
    const messagesCollection = await db.collection({
      name: "messages",
      schema: schema
    });

    // set up replication
    const replicationState = messagesCollection.sync({ remote: syncURL + dbName + "/" });
    this.subs.push(
      replicationState.change$.subscribe(change => {
        toast("Replication change");
        console.dir(change);
      })
    );
    this.subs.push(replicationState.docs$.subscribe(docData => console.dir(docData)));
    this.subs.push(replicationState.active$.subscribe(active => toast(`Replication active: ${active}`)));
    this.subs.push(replicationState.complete$.subscribe(completed => toast(`Replication completed: ${completed}`)));
    this.subs.push(
      replicationState.error$.subscribe(error => {
        toast("Replication Error");
        console.dir(error);
      })
    );

    return db;
  }

  async componentDidMount() {
    this.db = await this.createDatabase();

    // Subscribe to query to get all messages
    const sub = this.db.messages
      .find()
      .sort({ id: 1 })
      .$.subscribe(messages => {
        if (!messages) return;
        console.log("messages", messages);
        toast("Reloading messages");
        this.setState({ messages: messages });
      });
    this.subs.push(sub);
  }

  componentWillUnmount() {
    // Unsubscribe from all subscriptions
    this.subs.forEach(sub => sub.unsubscribe());
  }

  handleImageUpload = event => {
    this.addMessage(event.target.files[0]);
  };

  render() {
    console.log("this.state.messages", this.state.messages);
    return (
      <div className="App">
        <ToastContainer autoClose={3000} />
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>

        <div>{this.renderMessages()}</div>

        <GetStorage
          render={({ usedBytes, grantedBytes }) => {
            console.log({ usedBytes, grantedBytes });
            return (
              <div>
                Using {usedBytes}/{grantedBytes} bytes
              </div>
            );
          }}
        />

        <div id="add-message-div">
          <h3>Add Message</h3>
          <input
            type="file"
            name="myImage"
            accept=".png,.gif,.jpg"
            placeholder="My Image"
            onChange={this.handleImageUpload}
          />
        </div>
      </div>
    );
  }

  renderMessages() {
    return this.state.messages.map(doc => {
      //const date = moment(id, "x").fromNow();
      const thumbStyle = {
        margin: 5,
        border: "1px solid silver",
        display: "inline-block"
      };
      return (
        <div key={doc.id} style={thumbStyle}>
          <WithRxDBAttachment
            document={doc}
            filename="icon.png"
            render={url => {
              return url && <img src={url} width={50} height={50} />;
            }}
          />
        </div>
      );
    });
  }

  handleMessageChange = event => {
    this.setState({ newMessage: event.target.value });
  };

  // use image base64
  async addMessage(blob) {
    const id = Date.now().toString();
    const newMessage = { id, message: this.state.newMessage };

    const doc = await this.db.messages.insert(newMessage);

    blobUtil
      .blobToBase64String(blob)
      .then(b64 => {
        return doc
          .putAttachment({
            id: "icon.png",
            data: "data:image/png;base64," + b64,
            type: "image/png"
          })
          .then(() => {
            this.setState({ newMessage: "" });
          });
      })
      .catch(function(err) {
        // image failed to load
        console.log("err", err);
      });
  }
}

export default App;
