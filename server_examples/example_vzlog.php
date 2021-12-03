<?php
/**
 * Example of getting data using PHP.
 * @author Vasily Zakharov <vz@vz.team>
 */

$input = file_get_contents('php://input');
$data = json_decode($input,true);
var_dump($data);