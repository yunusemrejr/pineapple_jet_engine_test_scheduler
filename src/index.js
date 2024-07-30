 

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { notify } from './notification';

// Expose the notify function globally
window.notify = notify;

ReactDOM.render(<App />, document.getElementById('root'));
