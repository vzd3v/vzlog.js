<?php

$input = file_get_contents('php://input');
$data = json_decode($input);
var_dump($data);