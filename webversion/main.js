/**
 * Adds a  draggable marker to the map..
 *
 * @param {H.Map} map                      A HERE Map instance within the
 *                                         application
 * @param {H.mapevents.Behavior} behavior  Behavior implements
 *                                         default interactions for pan/zoom
 */

//initial setup
let r_e=6731; //Earth Radius in Kilometers
let imgSize=512; //pixelsize of image
let plotLim=15000; //max plot length of baselines
let n_iter=50; //number of iterations
let cc = 9e-6 //contrast constant


function Pol2Cart(r,phi,delta){
let x = r*Math.cos(delta/180*Math.PI)*Math.cos(phi/180*Math.PI);
let y = -r*Math.cos(delta/180*Math.PI)*Math.sin(phi/180*Math.PI);
let z = r*Math.sin(delta/180*Math.PI);

return [x,y,z];
}

//Globe Telescope Locations
let locations = [];

let source = [0,0];

let first_i=0;

let last_i=0;  

  
let u_v_grids=[];
let images=[];
 
//update plots according to telescopes and selected time
function updateUVtracks(){

  images=[];

  //update source declination
  source = [200, declination_control.value];
  let elev_lim=elev_lim_control.value; //elevetion limit for telescopes in degree

  //calculate u-v transformation matrix from source coordinates
  let H_var=source[0]/180*Math.PI;
  let delta=source[1]/180*Math.PI;

  let matrix=[[Math.sin(H_var),Math.cos(H_var),0],
        [-Math.sin(delta)*Math.cos(H_var),Math.sin(delta)*Math.sin(H_var),Math.cos(delta)],
        [Math.cos(delta)*Math.cos(H_var),-Math.cos(delta)*Math.sin(H_var),Math.sin(delta)]];

  let source_vector=Pol2Cart(r_e,source[0],source[1]);

  function getUV(Tel1,Tel2,matrix){
    let baseline=[Tel2[0]-Tel1[0],Tel2[1]-Tel1[1],Tel2[2]-Tel1[2]];
    return [matrix[0][0]*baseline[0]+matrix[0][1]*baseline[1]+matrix[0][2]*baseline[2],
            matrix[1][0]*baseline[0]+matrix[1][1]*baseline[1]+matrix[1][2]*baseline[2],
            matrix[2][0]*baseline[0]+matrix[2][1]*baseline[2]+matrix[2][2]*baseline[2]];

  }

	//calculate number of baselines
	let n_baselines=Math.round(count_telescopes*(count_telescopes-1)/2);

	let pixelSize=plotLim*2/imgSize;

	//create array to save uv_tracks for every baseline
	let u_v_tracks=[];
  
  let u_v_grid=Array(imgSize).fill().map(() => Array(imgSize).fill(0)); //create uv_coverage image
  
  let image=[]; //create image
  
	let u_v_track=Array(n_baselines).fill().map(() => Array(2).fill([]));

  let first=true;

  first_i=0;
  last_i=0;
  
  for (let i = 0; i < n_iter; i++) {

    let t=360/n_iter*i;
    
    //convert all telescope positions to cartesian coordinates
    let tels=[];
    let tel_visible=[]; //array to store boolean information whether telescope can see the source or not
    //for loop to set tels and tel_visible values
    for (let j=0; j<telescopes.length;j++){
       	let new_lng=telescopes[j].getGeometry().lng+t;
        if(new_lng>180){
            new_lng=new_lng-360;
        }
        let tel=Pol2Cart(r_e,new_lng,telescopes[j].getGeometry().lat);
        tels[j]=tel;

          //determine whether source is visible to telescope
          let dot_prod=tel[0]*source_vector[0]+tel[1]*source_vector[1]+tel[2]*source_vector[2];
          if (dot_prod/Math.pow(r_e,2)<Math.cos((90-elev_lim)/180*Math.PI)){
              tel_visible[j]=false;
          }else{
              tel_visible[j]=true;
          }       
     }
    
     
      let baseline_count=0
      for (let m=0; m<tels.length;m++){
          if (m<(tels.length-1)){
              for (let l=m+1;l<tels.length;l++){
                  if(tel_visible[m] && tel_visible[l]){				

                      if (first){
                        first=false;
                        first_i=i.toString();
                      };

                      //get new u_v data point
                      var baseline_uv=getUV(tels[m],tels[l],matrix);
                      var u=baseline_uv[0];
                      var v=baseline_uv[1];

                      //append new u_v point to baseline u_v track
                      //u_v_track[baseline_count][0].push(u);
                      //u_v_track[baseline_count][1].push(v);

                      //change u_v_sampling grid
                      var x_ind=Math.floor((u+plotLim)/pixelSize);
                      var y_ind=Math.floor((v+plotLim)/pixelSize);

                      u_v_grid[y_ind][x_ind]=1;

                      var x_ind=Math.floor((-u+plotLim)/pixelSize);
                      var y_ind=Math.floor((-v+plotLim)/pixelSize);

                      u_v_grid[y_ind][x_ind]=1;

                      last_i=i;
									}
                  baseline_count+=1;
               }
            }
       }
      u_v_tracks[i]=JSON.parse(JSON.stringify(u_v_track)); //JSON parse part save array in current status so it doesnt get overwritten
      u_v_grids[i]=JSON.parse(JSON.stringify(u_v_grid));
      }

  DrawUVCanvas(u_v_grid);

  for (ai=first_i;ai<=last_i;ai++){
    DrawFourierCanvas(u_v_grids[ai]);
  };
  

  ctx_image.putImageData(images[last_i-parseInt(first_i)], 0, 0);

  //set time control element from start to end of observation
  time_control.min=first_i;
  time_control.max=last_i.toString();
  time_control.value=last_i.toString();
  time_control.style.display = '';

  //Draw 3D globe
  locations = [];
  for (j=0;j<telescopes.length;j++){
    locations.push({"latitude": telescopes[j].getGeometry().lat, "longitude": telescopes[j].getGeometry().lng})
  } 


  
  drawGlobe();
  drawGraticule();
  RotateGlobe(source[0]+360/n_iter*last_i-45,-source[1]);
 
}


function DrawFourierCanvas(u_v_grid){

  //calculate the Fourier Transform

  var h_es=[];
  for (var ai=0; ai < imgSize; ai++){
    for (var ak=0; ak < imgSize; ak++){
      h_es.push(u_v_grid[ai][ak]*255);
    };    
  };

  h=function(n,m){
    if (arguments.length ===0) return h_es;
    return h_es[idx];
  };

  var h_hats = [];
  Fourier.transform(h(), h_hats);
  h_hats = Fourier.shift(h_hats, [imgSize,imgSize]);

  // get the largest magnitude
  var maxMagnitude = 0;
  for (var ai = 0; ai < h_hats.length; ai++) {
    var mag = h_hats[ai].magnitude();
    if (mag > maxMagnitude) {
      maxMagnitude = mag;
    };
  };

  // store them in a nice function to match the math
  $h = function(k, l) {
    if (arguments.length === 0) return h_hats;
    //flip second part of the fourier image (for some reason this needs to be done because fourier.js is wrong)
    if (l<imgSize/2){
      var idx = k*imgSize + l;
    } else {
      if(k==511){
        k=-1;
      };
      var idx = (imgSize-k-2)*imgSize + l;
    }
    return h_hats[idx];
  };

  // clear the canvas
  ctx_image.clearRect(0,0,canvas_img.width,canvas_img.height);

  // draw the pixels
  var currImageData = ctx_image.getImageData(
    0, 0, imgSize, imgSize
  );
  var logOfMaxMag = Math.log(cc*maxMagnitude+1);
  for (var k = 0; k < imgSize; k++) {
    for (var l = 0; l < imgSize; l++) {
      var idxInPixels = 4*(imgSize*k + l);
      currImageData.data[idxInPixels+3] = 255; // full alpha
      var color = Math.log(cc*$h(l, k).magnitude()+1);
      color = Math.round(255*(color/logOfMaxMag));
      // RGB are the same -> gray
      for (var c = 0; c < 3; c++) { // lol c++
        currImageData.data[idxInPixels+c] = color;
      }
    }
  }
  
  images.push(currImageData);

}


function DrawUVCanvas(img_data){


// clear the canvas
ctx_uv.clearRect(0,0,canvas_uv.width,canvas_uv.height);

for (y=0; y < img_data.length; y++){
  for (x=0; x < img_data[0].length; x++){
    ctx_uv.fillStyle=["black","white"][img_data[y][x]];
    ctx_uv.fillRect(x,y,1,1)
  };
};

}


function addDraggableMarker(map, behavior){

  var marker = new H.map.Marker({lat:map.getCenter().lat, lng:map.getCenter().lng}, {
    // mark the object as volatile for the smooth dragging
    volatility: true
  });
  // Ensure that the marker can receive drag events
  marker.draggable = true;
  map.addObject(marker);

  // disable the default draggability of the underlying map
  // and calculate the offset between mouse and target's position
  // when starting to drag a marker object:
  map.addEventListener('dragstart', function(ev) {
    var target = ev.target,
        pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
      var targetPosition = map.geoToScreen(target.getGeometry());
      target['offset'] = new H.math.Point(pointer.viewportX - targetPosition.x, pointer.viewportY - targetPosition.y);
      behavior.disable();
    }
  }, false);


  // re-enable the default draggability of the underlying map
  // when dragging has completed
  map.addEventListener('dragend', function(ev) {
  	//when dragging is complete update uv coverage and other plots
    var target = ev.target;
    if (target instanceof H.map.Marker) {
      behavior.enable();
    }
  }, false);

  // Listen to the drag event and move the position of the marker
  // as necessary
   map.addEventListener('drag', function(ev) {
    var target = ev.target,
        pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
      target.setGeometry(map.screenToGeo(pointer.viewportX - target['offset'].x, pointer.viewportY - target['offset'].y));
    }
  }, false);
  
return marker;
}

/**
 * Boilerplate map initialization code starts below:
 */


var defaultLayers = platform.createDefaultLayers();

//Step 2: initialize a map - this map is centered over Boston
var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
  center: {lat:50.35805, lng:10.0636},
  zoom: 3,
  pixelRatio: window.devicePixelRatio || 1
});
// add a resize listener to make sure that the map occupies the whole container
window.addEventListener('resize', () => map.getViewPort().resize());

//Step 3: make the map interactive
// MapEvents enables the event system
// Behavior implements default interactions for pan/zoom (also on mobile touch environments)
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

// Step 4: Create the default UI:
var ui = H.ui.UI.createDefault(map, defaultLayers, 'en-US');

var telescopes = [];
var count_telescopes= 0;

//add event listener to Add Telescope button
var add_tel_button = document.getElementById("add_tel_button");
add_tel_button.addEventListener('click', function() { 
	var marker_new=addDraggableMarker(map,behavior);
  telescopes[count_telescopes]=marker_new;
  count_telescopes++;
  }, false);

//add event listener to Add Telescope button
var measure_button = document.getElementById("measure_button");
measure_button.addEventListener('click', function() { 
  //turn on loading screen
  loading_screen.style.display = 'block';
  setTimeout(function(){
    updateUVtracks();
    //turn off loading screen
    loading_screen.style.display = 'none';
  }, 20);
}, false);

var time_control = document.getElementById("time_control");
time_control.addEventListener('input', function () {
  var indx = Math.floor(time_control.value);
	DrawUVCanvas(u_v_grids[indx]);
  ctx_image.putImageData(images[indx-parseInt(first_i)], 0, 0);
  RotateGlobe(source[0]+360/n_iter*indx-45,-source[1]);
  }, false);
time_control.step=n_iter/100;
time_control.style.display = 'none';
  

var declination_control = document.getElementById("declination_control");

var elev_lim_control = document.getElementById("elev_lim_control");

var canvas_img=document.getElementById("canvas_image");
canvas_img.width=imgSize;
canvas_img.height=imgSize;
var ctx_image=canvas_image.getContext('2d');

var canvas_uv=document.getElementById("canvas_uv");
canvas_uv.width=imgSize;
canvas_uv.height=imgSize;
var ctx_uv=canvas_uv.getContext('2d');

var loading_screen = document.getElementById("cover-spin");
