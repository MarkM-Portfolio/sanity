'use strict';

import Bootstrap from 'bootstrap/dist/css/bootstrap.css';
import React from 'react';
import ReactDOM from 'react-dom';
import { Button, Table, ListGroup, ListGroupItem } from 'react-bootstrap';

import { Panel, PanelGroup } from 'react-bootstrap';

const $ = require('jquery');

require('bootstrap/dist/css/bootstrap.css');

function klassOfResult(result) {
  var klass = '';
  if (result.status && result.status.ready) {
    // if (result.status.results.warnings.length > 0) {
    //   klass = 'warning';
    // } else {
    //   klass = 'success';
    // }
    klass = 'success';
  } else {
    klass = 'danger';
  }
  return klass;
}

function summaryOfLogItem(item) {
  if (typeof(item) === 'string') {
    return item;
  }
  return JSON.stringify(item);
}

function listGroupItemsOfLogs(logs, style) {
  var itemsList = logs.map(function(item) {
    return(
      <ListGroupItem bsStyle={style}>
        {summaryOfLogItem(item)}
      </ListGroupItem>
    );
  });
  return itemsList;
}

function serviceInformation(r) {
  var started_at = 'N/A', finished_at = 'N/A';
  if (r.status) {
    started_at = new Date(r.status.check_started_at);
    finished_at = new Date(r.status.check_finished_at);
    return (
      <ListGroup>
        <ListGroupItem>Address: <b>{r.status.address}</b></ListGroupItem>
        <ListGroupItem>Checked at: <b>{started_at.toLocaleString()}</b></ListGroupItem>
        <ListGroupItem>done at: <b>{finished_at.toLocaleString()}</b></ListGroupItem>
      </ListGroup>
    );
  } else {
    return (
      <ListGroup>
        <ListGroupItem>N/A</ListGroupItem>
      </ListGroup>
    )
  }
}

function resultPanels(results) {
  var panels = results.map(function(r, i) {
    var klass = klassOfResult(r),
        info, errors, warnings;
    if (! (r.status && r.status.checks)) {
      return (
        <Panel header={r.name} eventKey={i + 1} bsStyle={klass}>
        </Panel>
      );
    }

    info = r.status.checks.reduce(function(sum, item){
      return sum.concat(item.info);}, []);
    errors = r.status.checks.reduce(function(sum, item){
      return sum.concat(item.errors);}, []);
    warnings = r.status.checks.reduce(function(sum, item){
      return sum.concat(item.warnings);}, []);
    var service_info = serviceInformation(r),
        info_list = listGroupItemsOfLogs(info, 'info'),
        errors_list = listGroupItemsOfLogs(errors, 'danger'),
        warnings_list = listGroupItemsOfLogs(warnings, 'warning'),
        info_div, errors_div, warnings_div;

    if (info.length > 0) {
      info_div = <div>
        <h4>Infomation:</h4>
        <ListGroup>{info_list}</ListGroup>
      </div>
    }
    if (errors.length > 0) {
      errors_div = <div>
        <h4>Errors: <span className='badge badge-danger'>{errors.length}</span></h4>
        <ListGroup>{errors_list}</ListGroup>
      </div>;
    }
    if (warnings.length > 0 ) {
      warnings_div = <div>
        <h4>Warnings:</h4>
        <ListGroup>{warnings_list}</ListGroup>
      </div>
    }
    return(
      <Panel header={r.name} eventKey={i + 1} bsStyle={klass}>
        {service_info}
        {info_div}
        {errors_div}
        {warnings_div}
      </Panel>
    )
  });
  return panels;
}

function panelGroupCheckupResult(results) {
  var panels = resultPanels(results);
  return(
    <PanelGroup accordion>
      {panels}
    </PanelGroup>
  );
}

class CheckupResult extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.loadResult = this.loadResult.bind(this);
  }
  loadResult() {
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      cache: false,
      success: function(data) {
        this.setState({results: data});
      }.bind(this),
      error: function(xhr, status, err) {
        console.error(status, err.toString());
      }.bind(this)
    });
  }
  componentDidMount() {
    this.loadResult();
    var interval = this.props.pollInterval || 30000;
    setInterval(this.loadResult, interval);
  }
  render() {
    var results = this.state.results;
    if (results === undefined) {
      return(<p>No Results To Display Yet</p>);
    }
    return panelGroupCheckupResult(results);
  }
}


ReactDOM.render(
  <CheckupResult url="api"/>,
  document.getElementById('checkResultT'));

//ReactDOM.render(tableCheckResult, document.getElementById('checkResultT'));
//ReactDOM.render(panelGroupCheckupResult, document.getElementById('checkResultP'));
//ReactDOM.render(buttonsInstance, document.getElementById('thebutton'));
