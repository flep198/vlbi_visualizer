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

var elev_lim=0;
 
//update plots according to telescopes and selected time
function updateUVtracks(){

  setTimeout(function(){drawGlobe();drawGlobe()},200)

  images=[];

  //update source declination
  source = [200, declination_control.value];
  elev_lim=parseInt(elev_lim_control.value); //elevetion limit for telescopes in degree

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

  DrawUVCanvas(u_v_grid,ctx_uv,canvas_uv);
  DrawUVCanvas(u_v_grid,ctx_uv_map,canvas_uv_map)

  for (ai=first_i;ai<=last_i;ai++){
    DrawFourierCanvas(u_v_grids[ai]);
  };
  

  ctx_image.putImageData(images[last_i-parseInt(first_i)], 0, 0);
  ctx_image_map.putImageData(images[last_i-parseInt(first_i)], 0, 0);

  //set time control element from start to end of observation
  time_control.min=first_i;
  time_control.max=last_i.toString();
  time_control.value=last_i.toString();
  time_control.style.display = '';
  play_button.style.display = '';

  //Draw 3D globe
  locations = [];
  for (j=0;j<telescopes.length;j++){
    locations.push({"latitude": telescopes[j].getGeometry().lat, "longitude": telescopes[j].getGeometry().lng})
  } 

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


function DrawUVCanvas(img_data,ctx_uv,canvas_uv){

// clear the canvas
ctx_uv.clearRect(0,0,canvas_uv.width,canvas_uv.height);

for (y=0; y < img_data.length; y++){
  for (x=0; x < img_data[0].length; x++){
    ctx_uv.fillStyle=["black","white"][img_data[y][x]];
    ctx_uv.fillRect(x,y,1,1)
  };
};

}


function addDraggableMarker(map, behavior, latitude, longitude){

  var icon = new H.map.Icon('https://cdn-icons-png.flaticon.com/512/1082/1082826.png',{ size: { w: 56, h: 56 }});

  var marker = new H.map.Marker({lat:latitude, lng:longitude}, {
    // mark the object as volatile for the smooth dragging
    volatility: true,
    icon: icon
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

//Step 2: initialize a map
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
	var marker_new=addDraggableMarker(map,behavior,map.getCenter().lat,map.getCenter().lng);
  telescopes[count_telescopes]=marker_new;
  count_telescopes++;
  }, false);

//add event listener to Measure button
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

//add event listener to Play button
var play_button = document.getElementById("play_button");
play_button.addEventListener('click', function() { 
  let count=0;
  for (let idx=parseInt(time_control.min);idx<=parseInt(time_control.max);idx++){
    setTimeout(function(){
      time_control.value=idx.toString();
      time_control.dispatchEvent(new Event('input'));
    }, count*250);
    count++;
  }
}, false);
play_button.style.display = 'none';




var time_control = document.getElementById("time_control");
time_control.addEventListener('input', function () {
  var indx = Math.floor(time_control.value);
	DrawUVCanvas(u_v_grids[indx],ctx_uv,canvas_uv);
  ctx_image.putImageData(images[indx-parseInt(first_i)], 0, 0);
  RotateGlobe(source[0]+360/n_iter*indx-45,-source[1]);
  }, false);
time_control.step=n_iter/100;
time_control.style.display = 'none';
  

var declination_control = document.getElementById("declination_control");

var elev_lim_control = document.getElementById("elev_lim_control");

//image for main page
var canvas_img=document.getElementById("canvas_image");
canvas_img.width=imgSize;
canvas_img.height=imgSize;
var ctx_image=canvas_img.getContext('2d');
//initialize canvas as black box
ctx_image.fillRect(0, 0, imgSize, imgSize);


//image for map page
var canvas_img_map=document.getElementById("canvas_image_map");
canvas_img_map.width=imgSize;
canvas_img_map.height=imgSize;
var ctx_image_map=canvas_img_map.getContext('2d');
ctx_image_map.fillRect(0, 0, imgSize, imgSize);

//uv plot for main page
var canvas_uv=document.getElementById("canvas_uv");
canvas_uv.width=imgSize;
canvas_uv.height=imgSize;
var ctx_uv=canvas_uv.getContext('2d');
ctx_uv.fillRect(0, 0, imgSize, imgSize);

//uv plot for map page
var canvas_uv_map=document.getElementById("canvas_uv_map");
canvas_uv_map.width=imgSize;
canvas_uv_map.height=imgSize;
var ctx_uv_map=canvas_uv_map.getContext('2d');
ctx_uv_map.fillRect(0, 0, imgSize, imgSize);


var loading_screen = document.getElementById("cover-spin");


// pre-defined telescope arrays

//function to add list of telescopes

var preset_locations = [];
var checkboxes = [];

function addTelescopesToMap(tel_locations){
  for (i=0;i<tel_locations.length;i++){
    var marker_new=addDraggableMarker(map,behavior,tel_locations[i][0],tel_locations[i][1]);
    telescopes[count_telescopes]=marker_new;
    count_telescopes++;
  };
}

function removeTelescopesFromMap(tel_locations){
  if (tel_locations.length>0){
    for (i=0;i<tel_locations.length;i++){    

      function checkTel(telescope) {
        return telescope.getGeometry().lat==tel_locations[i][0] && telescope.getGeometry().lng==tel_locations[i][1];
      };

      const index = telescopes.findIndex(checkTel);

      if (index > -1) {
        map.removeObject(telescopes[index]);
        telescopes.splice(index, 1);
        count_telescopes--;
      }
    };
  };
}

function changeCheckboxAction(){
  removeTelescopesFromMap(preset_locations);

  preset_locations=[];

  for(ai=0;ai<checkboxes.length;ai++){
    if(checkboxes[ai].box.checked){
      for(ak=0;ak<checkboxes[ai].locations.length;ak++){
        //append all Telescopes, but only once
        function checkTel(telescope) {
          return telescope[0]==checkboxes[ai].locations[ak][0] && telescope[1]==checkboxes[ai].locations[ak][1];
        };
        const index = preset_locations.findIndex(checkTel);
        if (index == -1) {
          preset_locations.push(checkboxes[ai].locations[ak]);
        };
      };
    };
  };
  addTelescopesToMap(preset_locations);
}

var vlba = document.getElementById('vlba');

var vlba_locations=[[42.93362, -71.98681],[41.77165, -91.574133],[30.635214, -103.944826],
      [35.775289, -106.24559],[34.30107, -108.11912],[31.956253, -111.612361],
      [37.23176, -118.27714],[48.13117, -119.68325],[19.80159, -155.45581],[17.75652, -64.58376]];

checkboxes.push({"box": vlba, "locations": vlba_locations});

vlba.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2017 = document.getElementById('eht2017');

var eht2017_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056]];
checkboxes.push({"box": eht2017, "locations": eht2017_locations});

eht2017.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2018 = document.getElementById('eht2018');

var eht2018_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056],[76.531203,-68.703161],[44.63389,5.90792],[31.9533,-111.615]];
checkboxes.push({"box": eht2018, "locations": eht2018_locations});

eht2018.addEventListener('change', function() {
  changeCheckboxAction();
});

var tanami = document.getElementById('tanami');

var tanami_locations=[[-30.31,149.57],[-31.30,149.07],[-33.00,148.26],[-42.80,147.44],[-31.87,133.81],[-25.89,27.67],[-14.38,132.15],[-29.05,115,35],[-36.43,174.66]];
checkboxes.push({"box": tanami, "locations": tanami_locations});

tanami.addEventListener('change', function() {
  changeCheckboxAction();
});

changeCheckboxAction();


drawGlobe();
drawGraticule();


//map modal
var map_modal = document.getElementById("map-modal");
var map_modal_btn = document.getElementById("map-modal-button");
var map_modal_span = document.getElementById("close-map-modal");
map_modal.style.display="none";
map_modal_btn.onclick = function() {map_modal.style.display = "block";}
map_modal_span.onclick = function() {map_modal.style.display = "none";}

//info modal for map
var info_modal1 = document.getElementById("info-modal-1");
var info_modal_btn1 = document.getElementById("info-modal-button-1");
var info_modal_span1 = document.getElementById("close-info-modal-1");
info_modal_btn1.onclick = function() {info_modal1.style.display = "block";}
info_modal_span1.onclick = function() {info_modal1.style.display = "none";}

//info modal for uv coverage
var info_modal2 = document.getElementById("info-modal-2");
var info_modal_btn2 = document.getElementById("info-modal-button-2");
var info_modal_span2 = document.getElementById("close-info-modal-2");
info_modal_btn2.onclick = function() {info_modal2.style.display = "block";}
info_modal_span2.onclick = function() {info_modal2.style.display = "none";}

//info modal for image
var info_modal3 = document.getElementById("info-modal-3");
var info_modal_btn3 = document.getElementById("info-modal-button-3");
var info_modal_span3 = document.getElementById("close-info-modal-3");
info_modal_btn3.onclick = function() {info_modal3.style.display = "block";}
info_modal_span3.onclick = function() {info_modal3.style.display = "none";}
