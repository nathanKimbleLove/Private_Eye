import React, { useState, useEffect } from 'react';

import './Message.css';

const Message = ({ data }) => {

  return (
    <div className={data.isNotif ? 'notif' : 'message'}>
      {!data.isNotif &&
      <p className="username">{data.username || data.user}</p>
      }
      <h5 className={data.isNotif ? 'notif-text' :"message-text"}>{data.message}</h5>
    </div>
)
}

export default Message;